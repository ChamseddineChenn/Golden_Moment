import apiClient from './axios';

export const eventsAPI = {
  getAll: async () => {
    const response = await apiClient.get('/events');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/events/${id}`);
    return response.data;
  },

  getByCategory: async (category: string) => {
    const response = await apiClient.get(`/events/category/${category}`);
    return response.data;
  },
};

export { authApi } from './auth';
