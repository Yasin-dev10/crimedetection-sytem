import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

let isRedirectingToLogin = false;

export function clearStoredSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";
    const isLoginRequest = requestUrl.includes("/auth/login");
    const isLogoutRequest = requestUrl.includes("/auth/logout");

    if (status === 401 && !isLoginRequest && !isLogoutRequest) {
      clearStoredSession();

      const path = window.location.pathname;
      const isPublicAnalysisSurface =
        path === "/" || path === "/analysis" || path.startsWith("/analysis/");

      // Keep guests on the public analysis landing flow instead of forcing login.
      if (isPublicAnalysisSurface) {
        return Promise.reject(error);
      }

      if (path !== "/login" && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default API;
