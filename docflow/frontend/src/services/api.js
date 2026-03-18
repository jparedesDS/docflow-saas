import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL || "http://localhost:8000"}/api/v1`,
});

// Attach JWT token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("docflow_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear session and reload to login screen
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("docflow_token");
      localStorage.removeItem("docflow_user");
      if (window.location.pathname !== "/login") {
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
