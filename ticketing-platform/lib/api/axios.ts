import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Don't retry on specific endpoints to avoid loops
    const noRetryEndpoints = ['/auth/me', '/auth/refresh', '/auth/login', '/auth/signup'];
    const isNoRetryEndpoint = noRetryEndpoints.some(endpoint => 
      originalRequest.url?.includes(endpoint)
    );

    if (isNoRetryEndpoint) {
      return Promise.reject(error);
    }

    // If access token expired and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh tokens
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Only redirect if we're not already on a public page
        if (typeof window !== 'undefined') {
          const publicPaths = ['/', '/auth/login', '/auth/signup'];
          if (!publicPaths.includes(window.location.pathname)) {
            window.location.href = '/auth/login';
          }
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
