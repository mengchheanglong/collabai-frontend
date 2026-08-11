<<<<<<< HEAD
// src/app/shared/models/auth.models.ts
// Frontend auth types. These adapt the backend's cookie/verification auth flow:
//   register (firstName/lastName) -> verify-email (code) -> login -> /auth/me.
=======
// Auth models — mirror the backend /api/v1/auth contract (docs/API-CONTRACT.md).
// All auth endpoints use the `{ success, data }` envelope; errors carry
// `{ code, message }` in the body.
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string;
  isVerified?: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string | null;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

<<<<<<< HEAD
export interface MessageResponse {
=======
export interface RegisterResponse {
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
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

export interface VerifyEmailRequest {
  code: string;
}

export interface VerifyEmailResponse {
  success: true;
}

export interface ResendVerificationResponse {
  message?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

<<<<<<< HEAD
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
=======
export interface ForgotPasswordResponse {
  message?: string;
}

export interface VerifyResetCodeRequest {
  code: string;
}

export interface VerifyResetCodeResponse {
  success: true;
}

export interface ResetPasswordRequest {
  password: string;
}

export interface ResetPasswordResponse {
  message?: string;
}
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
