/**
 * @TASK P1-S1-T2 - Login Page Integration Tests
 * @SPEC specs/screens/login.yaml
 * Tests for login form, validation, API integration, and user flows
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from '../index'
import * as api from '@/services/api'

// Mock the API module
vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LoginPage', () => {
  const apiPost = vi.mocked(api.default.post)

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage
    localStorage.clear()
    // Reset navigate
    mockNavigate.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  /**
   * Test 1: Form Elements Rendering
   */
  describe('Form Rendering', () => {
    it('should render login form with all elements', () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      // Check for logo
      expect(screen.getByText('Story Lens')).toBeInTheDocument()
      expect(screen.getByText('스토리 렌즈')).toBeInTheDocument()

      // Check for form elements
      expect(screen.getByLabelText('이메일')).toBeInTheDocument()
      expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /로그인/i })).toBeInTheDocument()

      // Check for helper text
      expect(screen.getByText('선생님이 만든 계정으로 로그인하세요')).toBeInTheDocument()
      expect(screen.getByText('꿈꾸는 카메라 프로그램')).toBeInTheDocument()
    })

    it('should have email input with correct attributes', () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일') as HTMLInputElement
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')
      expect(emailInput).toHaveAttribute('placeholder', '이메일을 입력하세요')
    })

    it('should have password input with correct attributes', () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const passwordInput = screen.getByLabelText('비밀번호') as HTMLInputElement
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
      expect(passwordInput).toHaveAttribute('placeholder', '비밀번호를 입력하세요')
    })
  })

  /**
   * Test 2: Button Disabled When Empty
   */
  describe('Form Validation', () => {
    it('should have login button disabled when fields are empty', () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const loginButton = screen.getByRole('button', { name: /로그인/i })
      expect(loginButton).toBeDisabled()
    })

    it('should have login button disabled when only email is filled', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      await user.type(emailInput, 'teacher@example.com')

      const loginButton = screen.getByRole('button', { name: /로그인/i })
      expect(loginButton).toBeDisabled()
    })

    it('should have login button disabled when only password is filled', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const passwordInput = screen.getByLabelText('비밀번호')
      await user.type(passwordInput, 'password123')

      const loginButton = screen.getByRole('button', { name: /로그인/i })
      expect(loginButton).toBeDisabled()
    })

    it('should enable login button when both fields are filled', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(emailInput, 'teacher@example.com')
      await user.type(passwordInput, 'password123')

      const loginButton = screen.getByRole('button', { name: /로그인/i })
      expect(loginButton).not.toBeDisabled()
    })

    it('should clear error when user starts typing', async () => {
      const user = userEvent.setup()

      // Mock API to return error
      apiPost.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Invalid credentials' },
        },
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')
      const loginButton = screen.getByRole('button', { name: /로그인/i })

      // Fill form and submit
      await user.type(emailInput, 'wrong@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(loginButton)

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
      })

      // Start typing - error should clear
      await user.type(emailInput, 'a')

      await waitFor(() => {
        expect(screen.queryByText('이메일 또는 비밀번호가 올바르지 않습니다')).not.toBeInTheDocument()
      })
    })
  })

  /**
   * Test 3: Successful Login
   */
  describe('Login Success', () => {
    it('should successfully login and navigate to home', async () => {
      const user = userEvent.setup()

      // Mock successful API response
      const mockResponse = {
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: '1',
            email: 'teacher@example.com',
            name: 'Teacher',
            role: 'teacher',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
        },
      }
      apiPost.mockResolvedValueOnce(mockResponse)

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')
      const loginButton = screen.getByRole('button', { name: /로그인/i })

      // Fill form
      await user.type(emailInput, 'teacher@example.com')
      await user.type(passwordInput, 'password123')

      // Submit
      await user.click(loginButton)

      // Verify API was called
      await waitFor(() => {
        expect(apiPost).toHaveBeenCalledWith('/api/auth/login', {
          email: 'teacher@example.com',
          password: 'password123',
        })
      })

      // Verify tokens were stored
      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'mock-access-token')
        expect(localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'mock-refresh-token')
      })

      // Verify navigation to home
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      })
    })

    it('should handle Enter key press on password field', async () => {
      const user = userEvent.setup()

      const mockResponse = {
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: '1',
            email: 'teacher@example.com',
            name: 'Teacher',
            role: 'teacher',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
        },
      }
      apiPost.mockResolvedValueOnce(mockResponse)

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(emailInput, 'teacher@example.com')
      await user.type(passwordInput, 'password123')
      await user.keyboard('{Enter}')

      // Verify API was called
      await waitFor(() => {
        expect(apiPost).toHaveBeenCalledWith('/api/auth/login', {
          email: 'teacher@example.com',
          password: 'password123',
        })
      })
    })
  })

  /**
   * Test 4: Login Failure
   */
  describe('Login Failure', () => {
    it('should display error message on login failure', async () => {
      const user = userEvent.setup()

      // Mock API error
      apiPost.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Invalid credentials' },
        },
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')
      const loginButton = screen.getByRole('button', { name: /로그인/i })

      // Fill form
      await user.type(emailInput, 'wrong@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(loginButton)

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
      })

      // Verify error role and aria-live
      const errorElement = screen.getByRole('alert')
      expect(errorElement).toHaveAttribute('aria-live', 'polite')
    })

    it('should not navigate on login failure', async () => {
      const user = userEvent.setup()

      apiPost.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Invalid credentials' },
        },
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')
      const loginButton = screen.getByRole('button', { name: /로그인/i })

      await user.type(emailInput, 'wrong@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(loginButton)

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
      })

      // Verify navigation was not called
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should not store tokens on login failure', async () => {
      const user = userEvent.setup()

      apiPost.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Invalid credentials' },
        },
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')
      const loginButton = screen.getByRole('button', { name: /로그인/i })

      await user.type(emailInput, 'wrong@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
      })

      // Verify tokens were not stored
      expect(localStorage.setItem).not.toHaveBeenCalled()
    })
  })

  /**
   * Test 5: Loading State
   */
  describe('Loading State', () => {
    it('should show loading state during login', async () => {
      const user = userEvent.setup()

      // Mock delayed API response
      apiPost.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    access_token: 'token',
                    refresh_token: 'refresh',
                    user: {
                      id: '1',
                      email: 'test@example.com',
                      name: 'Test',
                      role: 'teacher',
                      is_active: true,
                      created_at: '2024-01-01T00:00:00Z',
                    },
                  },
                }),
              100
            )
          )
      )

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')
      const loginButton = screen.getByRole('button', { name: /로그인/i })

      await user.type(emailInput, 'teacher@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(loginButton)

      // Verify loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /로그인 처리 중/i })).toBeInTheDocument()
        expect(screen.getByText('처리 중...')).toBeInTheDocument()
      })

      // Verify button is disabled during loading
      const loadingButton = screen.getByRole('button', { name: /로그인 처리 중/i })
      expect(loadingButton).toBeDisabled()
    })

    it('should disable input fields during login', async () => {
      const user = userEvent.setup()

      apiPost.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    access_token: 'token',
                    refresh_token: 'refresh',
                    user: {
                      id: '1',
                      email: 'test@example.com',
                      name: 'Test',
                      role: 'teacher',
                      is_active: true,
                      created_at: '2024-01-01T00:00:00Z',
                    },
                  },
                }),
              100
            )
          )
      )

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')
      const loginButton = screen.getByRole('button', { name: /로그인/i })

      await user.type(emailInput, 'teacher@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(loginButton)

      // Verify inputs are disabled during loading
      await waitFor(() => {
        expect(emailInput).toBeDisabled()
        expect(passwordInput).toBeDisabled()
      })
    })
  })

  /**
   * Test 6: Accessibility
   */
  describe('Accessibility', () => {
    it('should have proper ARIA attributes on error state', async () => {
      const user = userEvent.setup()

      apiPost.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Invalid credentials' },
        },
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText('이메일')
      const passwordInput = screen.getByLabelText('비밀번호')
      const loginButton = screen.getByRole('button', { name: /로그인/i })

      await user.type(emailInput, 'wrong@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
      })

      // Check aria-invalid on inputs
      expect(emailInput).toHaveAttribute('aria-invalid', 'true')
      expect(passwordInput).toHaveAttribute('aria-invalid', 'true')

      // Check aria-describedby
      expect(emailInput).toHaveAttribute('aria-describedby', 'login-error')
      expect(passwordInput).toHaveAttribute('aria-describedby', 'login-error')
    })

    it('should have proper form labels', () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailLabel = screen.getByText('이메일')
      const passwordLabel = screen.getByText('비밀번호')

      expect(emailLabel).toHaveAttribute('for', 'email')
      expect(passwordLabel).toHaveAttribute('for', 'password')
    })
  })
})
