import axios from 'axios';

// Dynamic API URL that works on both localhost and mobile via local network
export const getAPIBaseURL = () => {
  if (typeof window === 'undefined') {
    // Server-side rendering
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';
  }

  // Client-side: replace localhost with the actual host for local mobile testing
  let baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

  // Only replace localhost/127.0.0.1 with actual hostname if FRONTEND is on localhost
  // (for local mobile testing). Don't do this for production (Vercel) or other hosted environments.
  const frontendIsLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (
    frontendIsLocalhost &&
    (baseURL.includes('localhost') || baseURL.includes('127.0.0.1'))
  ) {
    // Replace localhost/127.0.0.1 with actual hostname for mobile compatibility
    const hostname = window.location.hostname;
    const port = 3002; // Backend port
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    baseURL = `${protocol}://${hostname}:${port}`;
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
    // Fallback: if no cookies are available, try to get refresh token from localStorage
    // and add it to request for manual refresh
    if (typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken && !document.cookie.includes('refresh_token')) {
        // Cookie missing but localStorage has token - try to refresh
        console.log('⚠️ Refresh token in localStorage but not in cookies');
      }
    }
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
        console.error(
          'API returned non-JSON response:',
          error.response?.status,
        );
        return Promise.reject(
          new Error(`API Error: ${error.response?.status}`),
        );
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
        // Fallback: try to use localStorage refresh token
        if (typeof window !== 'undefined') {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken && originalRequest.url?.includes('/auth/refresh')) {
            console.log(
              '⚠️ Refresh failed with cookies, attempting with localStorage token',
            );
            try {
              const response = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-with-token`,
                { refreshToken },
                { withCredentials: true },
              );
              if (response.data?.data?.accessToken) {
                // Store the new token in localStorage
                localStorage.setItem(
                  'refresh_token',
                  response.data.data.refreshToken || refreshToken,
                );
                console.log('✓ Token refreshed using localStorage fallback');
              }
              return apiClient(originalRequest);
            } catch (tokenRefreshError) {
              console.error('Token refresh failed:', tokenRefreshError);
            }
          }
        }

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
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
