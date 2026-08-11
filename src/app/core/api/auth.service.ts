// AuthService — real backend calls through the shared ApiClient.
// Verification + password-reset flows are cookie-based on the backend
// (httpOnly cookies set via withCredentials), so no email/token bodies needed.

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ResendVerificationResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  VerifyResetCodeRequest,
  VerifyResetCodeResponse,
} from '../../shared/models/auth.models';
import { ApiClient } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);

  register(body: RegisterRequest): Observable<RegisterResponse> {
    return this.api.post<RegisterResponse>('/auth/register', body);
  }

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', body);
  }

  logout(): Observable<{ message?: string }> {
    return this.api.post('/auth/logout');
  }

  me(): Observable<MeResponse> {
    return this.api.get<MeResponse>('/auth/me');
  }

  /** No body — the backend reads the email from the `registration_verification` cookie. */
  verifyEmail(body: VerifyEmailRequest): Observable<VerifyEmailResponse> {
    return this.api.post<VerifyEmailResponse>('/auth/verify-email', body);
  }

  /** No body — email read from the `registration_verification` cookie. */
  resendVerification(): Observable<ResendVerificationResponse> {
    return this.api.post<ResendVerificationResponse>('/auth/resend-email-verification');
  }

  forgotPassword(body: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.api.post<ForgotPasswordResponse>('/auth/request-password-reset', body);
  }

  /** No body — email read from the `password_reset_verification` cookie. */
  verifyResetCode(body: VerifyResetCodeRequest): Observable<VerifyResetCodeResponse> {
    return this.api.post<VerifyResetCodeResponse>('/auth/verify-password-reset', body);
  }

  /** No body — email read from the `password_reset_session` cookie. */
  resetPassword(body: ResetPasswordRequest): Observable<ResetPasswordResponse> {
    return this.api.post<ResetPasswordResponse>('/auth/reset-password', body);
  }
}
