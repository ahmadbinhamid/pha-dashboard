import axios from "axios";
import { clearCartStorage } from "@/context/cart";
import { clearOrderDraft } from "@/lib/orderDraftStorage";

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
      clearCartStorage();
      clearOrderDraft();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }

    const error = new Error(message) as Error & {
      status?: number;
      errors?: Array<{ field: string; message: string }>;
    };
    error.status = status;
    if (status === 422 && Array.isArray(err.response?.data?.errors)) {
      error.errors = err.response.data.errors;
    }
    return Promise.reject(error);
  },
);
