import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const noRefreshRoutes = [
  '/auth/login',
  '/auth/register',
  '/auth/logout',
  '/auth/password-reset-request',
  '/auth/verify-reset-code',
  '/auth/reset-password',
  '/auth/resend-reset-code',
  '/auth/resend-verification-code',
];

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let isRefreshing = false;
const refreshQueue: Array<(shouldRetry: boolean, error?: unknown) => void> = [];
let csrfToken: string | null = null;

const processQueue = (shouldRetry: boolean, error?: unknown) => {
  while (refreshQueue.length > 0) {
    const callback = refreshQueue.shift();
    if (callback) {
      callback(shouldRetry, error);
    }
  }
};

/**
 * Fetch CSRF token from backend
 * Call GET /csrf/token to get a fresh token
 */
const fetchCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await axios.get(`${API_URL}/csrf/token`, {
      withCredentials: true,
    });

    csrfToken = response.data.csrfToken;
    return csrfToken;
  } catch {
    return null;
  }
};

// Initialize CSRF token on app load
if (typeof window !== 'undefined') {
  fetchCsrfToken();
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
});

/**
 * Request interceptor: Add CSRF token to public state-changing requests
 */
apiClient.interceptors.request.use(
  async (config: CustomAxiosRequestConfig) => {
    if (
      config.method &&
      !['get', 'head', 'options'].includes(config.method.toLowerCase())
    ) {
      const publicRoutes = [
        '/auth/login',
        '/auth/register',
        '/auth/password-reset-request',
        '/auth/reset-password',
        '/auth/verify-reset-code',
      ];
      const isPublicRoute = publicRoutes.some((route) =>
        config.url?.includes(route),
      );

      if (isPublicRoute) {
        if (!csrfToken) {
          await fetchCsrfToken();
        }

        if (csrfToken) {
          config.headers['x-csrf-token'] = csrfToken;
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Response interceptor: Handle 401 (expired access token) with single-flight refresh
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as
      | CustomAxiosRequestConfig
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      if (
        originalRequest.url?.includes('/auth/refresh') ||
        noRefreshRoutes.some((route) => originalRequest.url?.includes(route))
      ) {
        return Promise.reject(error);
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true;

        return new Promise((resolve, reject) => {
          refreshQueue.push((shouldRetry, refreshError) => {
            if (shouldRetry) {
              apiClient(originalRequest)
                .then(resolve)
                .catch(reject);
            } else {
              // Don't hard-redirect on /auth/me: pages use it to detect auth
              // state and render their own logged-out view (e.g. the landing page).
              if (
                typeof window !== 'undefined' &&
                !originalRequest.url?.includes('/auth/me')
              ) {
                window.location.href = '/login';
              }
              reject(refreshError ?? error);
            }
          });

          if (!isRefreshing) {
            isRefreshing = true;
            axios
              .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
              .then(() => {
                processQueue(true);
              })
              .catch((refreshError) => {
                processQueue(false, refreshError);
              })
              .finally(() => {
                isRefreshing = false;
              });
          }
        });
      }
    }

    return Promise.reject(error);
  }
);

export { fetchCsrfToken };
export default apiClient;
