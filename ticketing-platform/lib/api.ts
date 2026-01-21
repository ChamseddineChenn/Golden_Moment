import apiClient from './api/axios';

// Events API
export const eventsAPI = {
  create: (eventData: any) => {
    return apiClient.post('/events', eventData);
  },
  getAll: () => {
    return apiClient.get('/events');
  }, // Public - published only
  getAllAdmin: () => {
    return apiClient.get('/events/admin/all');
  }, // Admin - all events including drafts
  getById: (id: string) => {
    return apiClient.get(`/events/${id}`);
  },
  update: (id: string, eventData: any) => {
    return apiClient.put(`/events/${id}`, eventData);
  },
  delete: (id: string) => apiClient.delete(`/events/${id}`),
  deleteImage: (publicId: string) =>
    apiClient.post(`/upload/delete-image`, { publicId }),
};

// Upload API - uses backend for secure Cloudinary uploads
export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  // Upload to backend endpoint (backend handles Cloudinary API key/secret securely)
  const response = await apiClient.post('/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  // Extract data from standardized response format { success, statusCode, data, timestamp }
  const uploadData = response.data.data || response.data;

  return {
    secure_url: uploadData.secure_url,
    public_id: uploadData.public_id,
  };
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
  delete: (ticketId: string) => apiClient.delete(`/tickets/${ticketId}`),
};

// Seats API
export const seatsAPI = {
  getSeatMap: (eventId: string) =>
    apiClient.get(`/seats/event/${eventId}`, {
      params: { _t: Date.now() }, // Cache busting
    }),
  // Live reservation is now DEPRECATED - seats are only locked at payment
  reserveSeats: (data: {
    eventId: string;
    seats: { sectionId: string; seatId: string }[];
  }) => {
    return apiClient.post('/seats/reserve', data);
  },
  unreserveSeats: (data: {
    eventId: string;
    seats: { sectionId: string; seatId: string }[];
  }) => {
    return apiClient.post('/seats/unreserve', data);
  },
  // NEW: Atomic payment-based seat locking with race condition detection
  finalizePurchase: (data: {
    eventId: string;
    seats: { sectionId: string; seatId: string }[];
    buyerName: string;
    buyerEmail: string;
    buyerPhoneNumber: string;
    ticketType?: string;
  }) => {
    return apiClient.post('/seats/finalize-purchase', data);
  },
};

// Logs API
export const logsAPI = {
  getAll: (limit: number = 100, skip: number = 0) =>
    apiClient.get('/logs', { params: { limit, skip } }),
  getByAction: (action: string, limit: number = 100, skip: number = 0) =>
    apiClient.get('/logs/action', { params: { type: action, limit, skip } }),
  getForEvent: (eventId: string, limit: number = 100, skip: number = 0) =>
    apiClient.get(`/logs/event/${eventId}`, { params: { limit, skip } }),
};

export default apiClient;
