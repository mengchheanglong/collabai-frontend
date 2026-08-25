// Auth models — mirror the backend /api/v1/auth contract (docs/API-CONTRACT.md).
// All auth endpoints use the `{ success, data }` envelope; errors carry
// `{ code, message }` in the body.

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

export interface RegisterResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface MeResponse {
  user: AuthUser;
}

export interface VerifyEmailRequest {
  code: string;
  email?: string;
}

export interface ResendVerificationRequest {
  email?: string;
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
