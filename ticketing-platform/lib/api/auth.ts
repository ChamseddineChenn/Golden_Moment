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
   verifyEmail: async (token: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/verify-email', { token });
    return data;
  },

  resendVerification: async (email: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post('/auth/resend-verification', { email });
    return data;
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post('/auth/forgot-password', { email });
    return data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post('/auth/reset-password', { token, newPassword });
    return data;
  },
};
