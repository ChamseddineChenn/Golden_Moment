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
  getByPaymentId: (paymentId: string) =>
    apiClient.get(`/tickets/by-payment/${paymentId}`),
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
  // Reserve seats temporarily (5 minutes) when user clicks Purchase button
  reserveSeats: (
    eventId: string,
    seats: { sectionId: string; seatId: string }[],
  ) => {
    return apiClient.post(`/seats/event/${eventId}/reserve`, { seats });
  },
  // Release reservation if payment cancelled, failed, or timeout
  releaseReservation: (
    eventId: string,
    seats: { sectionId: string; seatId: string }[],
  ) => {
    return apiClient.post(`/seats/event/${eventId}/release`, { seats });
  },
  // Clean up expired reservations (auto-run periodically)
  cleanupExpiredReservations: (eventId: string) => {
    return apiClient.post(`/seats/event/${eventId}/cleanup-expired`);
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

// Payments API
export const paymentsAPI = {
  createCheckoutSession: (paymentData: any) =>
    apiClient.post('/payments/create-checkout-session', paymentData),
  createFreeTicket: (ticketData: any) =>
    apiClient.post('/payments/create-free-ticket', ticketData),
  getPayment: (paymentId: string) => apiClient.get(`/payments/${paymentId}`),
  getUserPayments: () => apiClient.get('/payments/user/payments'),
};

export default apiClient;
