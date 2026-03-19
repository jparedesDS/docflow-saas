import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL || "http://localhost:8000"}/api/v1`,
});

// Attach JWT token and tenant headers from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("docflow_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Propagate tenant_id from stored user data
  const userStr = localStorage.getItem("docflow_user");
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.tenant_id) {
        config.headers["X-Tenant-Id"] = String(user.tenant_id);
      }
    } catch {
      // ignore parse errors
    }
  }
  return config;
});

// Flag to prevent multiple refresh attempts simultaneously
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor — handle 401 (token refresh) + network/5xx errors
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Token refresh on 401 (not for login/refresh/register endpoints)
    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/tenants/register")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((e) => Promise.reject(e));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("docflow_refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${process.env.REACT_APP_API_URL || "http://localhost:8000"}/api/v1/auth/refresh`,
            { refresh_token: refreshToken }
          );
          localStorage.setItem("docflow_token", data.token);
          processQueue(null, data.token);
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          // Refresh failed — clear session and force re-login
          localStorage.removeItem("docflow_token");
          localStorage.removeItem("docflow_refresh_token");
          localStorage.removeItem("docflow_user");
          window.location.reload();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // No refresh token — clear session only if there was a token
      if (localStorage.getItem("docflow_token")) {
        localStorage.removeItem("docflow_token");
        localStorage.removeItem("docflow_refresh_token");
        localStorage.removeItem("docflow_user");
        window.location.reload();
      }
      return Promise.reject(err);
    }

    // Network errors and 5xx — dispatch custom event for toast display
    if (!err.response) {
      window.dispatchEvent(
        new CustomEvent("docflow:network-error", {
          detail: { message: "Error de conexión. Verifica tu red." },
        })
      );
    } else if (err.response.status >= 500) {
      window.dispatchEvent(
        new CustomEvent("docflow:network-error", {
          detail: { message: "Error del servidor. Inténtalo de nuevo." },
        })
      );
    }

    return Promise.reject(err);
  }
);

export default api;
