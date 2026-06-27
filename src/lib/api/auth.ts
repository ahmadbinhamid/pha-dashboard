import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { AuthUser } from "@/types/auth";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export async function login(payload: LoginPayload) {
  // OTP DISABLED — login now returns user + token directly (same shape as verifyOtp)
  const { data } = await apiClient.post<BeResponse<AuthUser>>(
    "/auth/login",
    payload,
  );
  return data;
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  const { data } = await apiClient.post<BeResponse<AuthUser>>(
    "/auth/verify-otp",
    payload,
  );
  return data;
}

export async function resendOtp(email: string) {
  const { data } = await apiClient.post<BeResponse>("/auth/resend-otp", { email });
  return data;
}

export async function getProfile() {
  const { data } = await apiClient.get<BeResponse<AuthUser>>("/user/profile");
  return data;
}
