import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    const noRetryEndpoints = ['/auth/me', '/auth/refresh', '/auth/login', '/auth/signup', '/auth/logout'];
    const isNoRetryEndpoint = noRetryEndpoints.some(endpoint => 
      originalRequest.url?.includes(endpoint)
    );

    if (isNoRetryEndpoint) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        return apiClient(originalRequest);
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          const publicPaths = ['/', '/auth/login', '/auth/signup', '/auth/signup-organizer'];
          const currentPath = window.location.pathname;
          
          if (!publicPaths.includes(currentPath)) {
            const redirectUrl = `${currentPath}${window.location.search}`;
            window.location.href = `/auth/login?redirect=${encodeURIComponent(redirectUrl)}`;
          }
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
