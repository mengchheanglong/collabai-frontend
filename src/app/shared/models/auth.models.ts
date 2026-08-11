// src/app/shared/models/auth.models.ts
// Frontend auth types. These adapt the backend's cookie/verification auth flow:
//   register (firstName/lastName) -> verify-email (code) -> login -> /auth/me.

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Backend login returns only the access token; the user is fetched via /auth/me. */
export interface LoginResponse {
  accessToken: string;
}

export interface MeResponse {
  user: AuthUser;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

/** The backend keeps the reset session in a cookie; this is a placeholder marker. */
export interface VerifyResetCodeResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendVerificationRequest {
  email: string;
}

// Response aliases used by the pages.
export type RegisterResponse = MessageResponse;
export type ForgotPasswordResponse = MessageResponse;
export type ResetPasswordResponse = MessageResponse;
export type VerifyEmailResponse = MessageResponse;
export type ResendVerificationResponse = MessageResponse;
