import axios from "axios";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(
  /\/$/,
  ""
);

const API = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,
});

export const API_BASE_URL = API_ORIGIN;

let isRedirectingToLogin = false;

const TOKEN_KEY = "token";
const USER_KEY = "user";

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function clearStoredSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function storeSession({ token, user }) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
  if (user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

API.interceptors.request.use((config) => {
  const token = getStoredToken();

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
