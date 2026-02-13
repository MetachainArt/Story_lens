import api from './api';
import type { CreateSessionRequest, Session } from '@/types/session';

interface ListSessionParams {
  year?: number;
  month?: number;
}

export const sessionsService = {
  async list(params?: ListSessionParams): Promise<Session[]> {
    const response = await api.get<Session[]>('/api/v1/sessions', { params });
    return response.data;
  },

  async create(data: CreateSessionRequest): Promise<Session> {
    const response = await api.post<Session>('/api/v1/sessions', data);
    return response.data;
  },
};

export default sessionsService;
