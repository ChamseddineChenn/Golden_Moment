import apiClient from './axios';

export interface ProfileUpdateData {
  email?: string;
  // Organizer fields
  organizationName?: string;
  phone?: string;
  address?: string;
  website?: string;
  description?: string;
  businessLicense?: string;
  organizationEstablishedDate?: string | Date;
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  data: any;
  emailVerificationRequired?: boolean;
}

export const usersApi = {
  getMyProfile: async (): Promise<any> => {
    const { data } = await apiClient.get('/users/me/profile');
    // Access nested data.data.data (3 levels deep)
    return data.data?.data || data.data || data;
  },

  updateMyProfile: async (updateData: ProfileUpdateData): Promise<ProfileResponse> => {
    const { data } = await apiClient.patch('/users/me/profile', updateData);
    // Access nested response
    return data.data || data;
  },
};
