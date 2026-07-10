/**
 * @TASK P1-S0-T1 - API Client with Auto Token Refresh
 * @SPEC Axios client with request/response interceptors for JWT handling
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { AUTH_FLAG_KEY } from '@/constants/auth';

const envApiUrl = import.meta.env.VITE_API_URL?.trim();
if (import.meta.env.PROD && !envApiUrl) {
  throw new Error('VITE_API_URL must be set in production');
}

const fallbackApiUrl =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : window.location.origin;

const api = axios.create({
  baseURL: envApiUrl || fallbackApiUrl,
  withCredentials: true,
});

// Track if we're currently refreshing
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

// Authentication relies entirely on httpOnly cookies (set by the backend on
// login/refresh and sent automatically because withCredentials is true). Tokens
// are never stored in localStorage, so they cannot be read or stolen via XSS.
// `AUTH_FLAG_KEY` is a non-sensitive marker used only to remember that the user
// has an active session across reloads.
function clearSessionAndRedirect() {
  localStorage.removeItem(AUTH_FLAG_KEY);
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Response interceptor - handle 401 and auto refresh via cookie
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for login/refresh endpoints
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // The refresh token travels in the httpOnly cookie; no body needed.
        await axios.post(
          `${api.defaults.baseURL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // New cookies are set by the server. Process queue and retry.
        processQueue();
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout
        processQueue(refreshError as Error);
        isRefreshing = false;
        clearSessionAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
