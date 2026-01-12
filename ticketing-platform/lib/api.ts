import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Events API
export const eventsAPI = {
  create: (eventData: any) => apiClient.post('/events', eventData),
  getAll: () => apiClient.get('/events'),
  getById: (id: string) => apiClient.get(`/events/${id}`),
  delete: (id: string) => apiClient.delete(`/events/${id}`),
};

// Tickets API
export const ticketsAPI = {
  create: (ticketData: any) => apiClient.post('/tickets', ticketData),
  getAll: () => apiClient.get('/tickets'),
  getById: (id: string) => apiClient.get(`/tickets/${id}`),
  getByEventId: (eventId: string) => apiClient.get(`/tickets/event/${eventId}`),
  getByTicketNumber: (ticketNumber: string) =>
    apiClient.get(`/tickets/by-number/${ticketNumber}`),
  search: (query: string) => apiClient.get(`/tickets/search?q=${query}`),
  markAsUsed: (ticketId: string) =>
    apiClient.post(`/tickets/${ticketId}/mark-used`),
  validate: (ticketNumber: string) =>
    apiClient.post('/tickets/validate', { ticketNumber }),
};

export default apiClient;
