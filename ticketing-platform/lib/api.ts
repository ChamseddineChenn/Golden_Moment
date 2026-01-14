import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Disable caching for all requests
  params: {
    // Add a timestamp to all requests to prevent caching
  },
});

// Add response interceptor to log seat data requests
apiClient.interceptors.response.use((response) => {
  if (response.config.url?.includes('/seats/')) {
    const unavailableCount = response.data?.seatingLayout?.sections?.reduce(
      (count, section) =>
        count +
        section.seats.filter((s) => s.status === 'unavailable').length,
      0
    ) || 0;
    const reservingCount = response.data?.seatingLayout?.sections?.reduce(
      (count, section) =>
        count +
        section.seats.filter((s) => s.status === 'reserving').length,
      0
    ) || 0;
    console.log(
      `[API] getSeatMap response: ${unavailableCount} unavailable, ${reservingCount} reserving`
    );
  }
  return response;
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

// Seats API
export const seatsAPI = {
  getSeatMap: (eventId: string) => 
    apiClient.get(`/seats/event/${eventId}`, {
      params: { _t: Date.now() }, // Cache busting
    }),
  reserveSeats: (data: {
    eventId: string;
    seats: { sectionId: string; seatId: string }[];
  }) => apiClient.post('/seats/reserve', data),
  unreserveSeats: (data: {
    eventId: string;
    seats: { sectionId: string; seatId: string }[];
  }) => apiClient.post('/seats/unreserve', data),
};

export default apiClient;
