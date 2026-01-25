import axios from 'axios';

// Dynamic API URL that works on both localhost and mobile via local network
const getAPIBaseURL = () => {
  if (typeof window === 'undefined') {
    // Server-side rendering
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';
  }

  // Client-side: replace localhost with the actual host
  let baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

  if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) {
    // Replace localhost/127.0.0.1 with actual hostname for mobile compatibility
    const hostname = window.location.hostname;
    const port = 3002; // Backend port
    baseURL = `http://${hostname}:${port}`;
  }

  return baseURL;
};

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
  },
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle non-JSON responses (e.g., HTML error pages)
    if (error.response?.status === 404 || error.response?.status === 500) {
      const contentType = error.response?.headers?.['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        console.error('API returned non-JSON response:', error.response?.status);
        return Promise.reject(new Error(`API Error: ${error.response?.status}`));
      }
    }

    const noRetryEndpoints = [
      '/auth/me',
      '/auth/refresh',
      '/auth/login',
      '/auth/signup',
      '/auth/logout',
    ];
    const isNoRetryEndpoint = noRetryEndpoints.some((endpoint) =>
      originalRequest.url?.includes(endpoint),
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
          { withCredentials: true },
        );

        return apiClient(originalRequest);
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          const publicPaths = [
            '/',
            '/auth/login',
            '/auth/signup',
            '/auth/signup-organizer',
          ];
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
  },
);

export default apiClient;
