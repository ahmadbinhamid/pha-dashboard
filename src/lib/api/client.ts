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
  async (err) => {
    // A blob request's JSON error body arrives as a Blob; parse it for the message.
    if (err.response?.data instanceof Blob && err.response.data.type?.includes("json")) {
      try {
        err.response.data = JSON.parse(await err.response.data.text());
      } catch {
        /* wasn't actually JSON — leave as-is */
      }
    }

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
      reason?: string;
      code?: string;
    };
    error.status = status;
    // A 409 names its conflict in jsonerr.code so callers can explain it.
    if (typeof err.response?.data?.jsonerr?.code === "string") {
      error.code = err.response.data.jsonerr.code;
    }
    if (status === 422 && Array.isArray(err.response?.data?.errors)) {
      error.errors = err.response.data.errors;
    }
    // Some 400s carry a machine-readable `reason` for a friendlier message.
    if (typeof err.response?.data?.reason === "string") {
      error.reason = err.response.data.reason;
    }
    return Promise.reject(error);
  },
);
