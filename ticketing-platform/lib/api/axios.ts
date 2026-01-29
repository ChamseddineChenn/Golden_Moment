import axios from 'axios';

// Dynamic API URL that works on both localhost and mobile via local network
export const getAPIBaseURL = () => {
  if (typeof window === 'undefined') {
    // Server-side rendering - check both env vars
    return (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:3002'
    );
  }

  // Client-side: check both env vars for compatibility
  let baseURL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:3002';

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
  baseURL: getAPIBaseURL(),
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
      const accessToken = localStorage.getItem('access_token');
      const cookies = document.cookie;
      
      // DEBUG: Log all token states at request time
      if (config.url?.includes('/auth/me')) {
        console.log('[DEBUG-REQUEST] /auth/me request:', {
          refreshTokenInStorage: !!refreshToken,
          accessTokenInStorage: !!accessToken,
          hasCookies: cookies.length > 0,
          cookieString: cookies,
          timestamp: new Date().toISOString(),
        });
      }
      
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
    if (response.config.url?.includes('/auth/me')) {
      console.log('[DEBUG-RESPONSE] /auth/me success:', {
        status: response.status,
        hasUser: !!response.data?.data?.user,
        timestamp: new Date().toISOString(),
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.log('[DEBUG-ERROR] API Error:', {
      endpoint: originalRequest?.url,
      status: error.response?.status,
      message: error.message,
      retry: originalRequest?._retry,
      timestamp: new Date().toISOString(),
    });

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
      console.log('[DEBUG] No-retry endpoint, rejecting:', originalRequest.url);
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('[DEBUG-401] Attempting to refresh tokens for:', originalRequest.url);
      originalRequest._retry = true;

      try {
        console.log('[DEBUG] Calling /auth/refresh...');
        const refreshResponse = await axios.post(
          `${getAPIBaseURL()}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        console.log('[DEBUG] /auth/refresh succeeded:', {
          status: refreshResponse.status,
          timestamp: new Date().toISOString(),
        });

        return apiClient(originalRequest);
      } catch (refreshError) {
        console.log('[DEBUG] /auth/refresh failed:', {
          status: (refreshError as any).response?.status,
          message: (refreshError as any).message,
        });
        
        // Fallback: try to use localStorage refresh token
        if (typeof window !== 'undefined') {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken && originalRequest.url?.includes('/auth/refresh')) {
            console.log(
              '⚠️ Refresh failed with cookies, attempting with localStorage token',
            );
            try {
              console.log('[DEBUG] Calling /auth/refresh-with-token with localStorage token...');
              const response = await axios.post(
                `${getAPIBaseURL()}/auth/refresh-with-token`,
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
              console.error('[DEBUG] localStorage fallback also failed:', {
                status: (tokenRefreshError as any).response?.status,
                message: (tokenRefreshError as any).message,
              });
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
          console.log('[DEBUG] Redirecting to login:', redirectUrl);
          window.location.href = `/auth/login?redirect=${encodeURIComponent(redirectUrl)}`;
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
