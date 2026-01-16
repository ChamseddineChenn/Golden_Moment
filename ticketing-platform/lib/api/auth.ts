import apiClient from './axios';
import { AuthResponse, User } from '../types/auth.types';

export const authApi = {
  signup: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/signup', {
      email,
      password,
    });
    return data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get<{ success: boolean; user: User }>('/auth/me');
    return data.user;
  },

  refreshTokens: async (): Promise<void> => {
    await apiClient.post('/auth/refresh');
  },
};
