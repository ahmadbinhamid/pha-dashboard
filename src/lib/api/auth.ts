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

// Creates a BRAND NEW tenant plus its first (admin) user — distinct from a
// hypothetical "join an existing tenant" flow, which this dashboard's UI
// doesn't expose (that's a staff-invite scenario, not self-service signup).
export interface RegisterTenantPayload {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

// A 2FA-enabled account resolves to just { email } (no token) — the caller
// verifies the OTP separately via verifyOtp — while everyone else gets the
// full AuthUser + token in one step, same as before 2FA existed.
export type LoginResponseData = AuthUser | { email: string };

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<BeResponse<LoginResponseData>>(
    "/auth/login",
    payload,
  );
  return data;
}

export async function registerTenant(payload: RegisterTenantPayload) {
  // Same response shape as login — new account is active immediately and
  // logged straight in, no separate verification step.
  const { data } = await apiClient.post<BeResponse<AuthUser>>(
    "/auth/register-tenant",
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

export async function updateProfile(payload: { first_name: string; last_name: string }) {
  const { data } = await apiClient.put<BeResponse<AuthUser>>("/user", payload);
  return data;
}

export async function setTwoFactor(payload: { enabled: boolean }) {
  const { data } = await apiClient.patch<BeResponse<AuthUser>>("/user/two-factor", payload);
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await apiClient.post<BeResponse>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(payload: { token: string; new_password: string }) {
  const { data } = await apiClient.post<BeResponse>("/auth/reset-password", payload);
  return data;
}

export async function changePassword(payload: { current_password: string; new_password: string }) {
  const { data } = await apiClient.post<BeResponse>("/auth/change-password", payload);
  return data;
}
