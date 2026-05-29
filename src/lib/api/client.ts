import axios from "axios";

const TOKEN_KEY = "auth_token";

export const getToken   = ()           => localStorage.getItem(TOKEN_KEY);
export const setToken   = (t: string)  => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = ()           => localStorage.removeItem(TOKEN_KEY);

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:7000/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status: number | undefined = err.response?.status;
    const message: string =
      err.response?.data?.message ?? err.message ?? "Something went wrong";

    if (status === 401) {
      clearToken();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }

    // Attach status so callers can distinguish auth failures from other errors
    const error = new Error(message) as Error & { status?: number };
    error.status = status;
    return Promise.reject(error);
  },
);
