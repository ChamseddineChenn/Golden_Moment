import apiClient from './axios';
import { AuthResponse, User, OrganizerSignupData } from '../types/auth.types';

export const authApi = {
  signup: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<{ data: AuthResponse }>(
      '/auth/signup',
      {
        email,
        password,
      },
    );
    return data.data; // ← Access nested data
  },

  signupOrganizer: async (
    organizerData: OrganizerSignupData,
  ): Promise<AuthResponse> => {
    const { data } = await apiClient.post<{ data: AuthResponse }>(
      '/auth/signup/organizer',
      organizerData,
    );
    return data.data; // ← Access nested data
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<{ data: AuthResponse }>(
      '/auth/login',
      {
        email,
        password,
      },
    );
    return data.data; // ← Access nested data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const { data } = await apiClient.get<{
        data: { success: boolean; user: User };
      }>('/auth/me');
      return data.data.user; // ← Access nested data.user
    } catch (error) {
      // 401 Unauthorized means user is not logged in - return null instead of throwing
      if (error instanceof Error || (error as any)?.response?.status === 401) {
        return null;
      }
      throw error;
    }
  },

  refreshTokens: async (): Promise<void> => {
    await apiClient.post('/auth/refresh');
  },

  verifyEmail: async (token: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<{ data: AuthResponse }>(
      '/auth/verify-email',
      { token },
    );
    return data.data; // ← Access nested data
  },

  resendVerification: async (
    email: string,
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{
      data: { success: boolean; message: string };
    }>('/auth/resend-verification', { email });
    return data.data; // ← Access nested data
  },

  forgotPassword: async (
    email: string,
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{
      data: { success: boolean; message: string };
    }>('/auth/forgot-password', { email });
    return data.data; // ← Access nested data
  },

  resetPassword: async (
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{
      data: { success: boolean; message: string };
    }>('/auth/reset-password', { token, newPassword });
    return data.data; // ← Access nested data
  },
};
