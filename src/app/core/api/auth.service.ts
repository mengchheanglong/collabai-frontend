// src/app/core/api/auth.service.ts
//
// Real auth client for the NestJS backend (cookie + email-verification flow).
// It ADAPTS the backend to the shapes the pages expect:
//   - the email in verify/reset flows is carried by an httpOnly cookie, so the body only
//     ever sends the fields the backend DTOs allow (extra fields are rejected by the API's
//     forbidNonWhitelisted validation);
//   - every call sends credentials so the registration/reset/refresh cookies flow;
//   - responses are unwrapped from the { success, data } envelope;
//   - errors are normalised to { error: { code, message } } so pages/stores can read
//     `err.error.message`.

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
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
  ResendVerificationRequest,
  ResendVerificationResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  VerifyResetCodeRequest,
  VerifyResetCodeResponse,
} from '../../shared/models/auth.models';

/** Backend success envelope: { success, data }. */
interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  register(body: RegisterRequest): Observable<RegisterResponse> {
    // Backend responds { message } and emails a verification code + sets a cookie.
    return this.post<{ message?: string }>('/auth/register', {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password,
    }).pipe(map((d) => ({ message: d.message ?? 'Account created.' })));
  }

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.post<{ accessToken: string }>('/auth/login', {
      email: body.email,
      password: body.password,
    }).pipe(map((d) => ({ accessToken: d.accessToken })));
  }

  me(): Observable<MeResponse> {
    return this.get<{ user: MeResponse['user'] }>('/auth/me').pipe(
      map((d) => ({ user: d.user })),
    );
  }

  logout(): Observable<null> {
    return this.post<unknown>('/auth/logout', {}).pipe(map(() => null));
  }

  // ----- email verification (email comes from the registration cookie) -----

  verifyEmail(body: VerifyEmailRequest): Observable<VerifyEmailResponse> {
    return this.post<unknown>('/auth/verify-email', { code: body.code }).pipe(
      map(() => ({ message: 'Email verified. You can now log in.' })),
    );
  }

  sendVerification(
    _body: ResendVerificationRequest,
  ): Observable<ResendVerificationResponse> {
    // No body — the backend reads the email from the registration cookie.
    return this.post<unknown>('/auth/resend-email-verification', {}).pipe(
      map(() => ({ message: 'Verification code sent.' })),
    );
  }

  // ----- password reset (email/session carried by cookies) -----

  forgotPassword(
    body: ForgotPasswordRequest,
  ): Observable<ForgotPasswordResponse> {
    return this.post<unknown>('/auth/request-password-reset', {
      email: body.email,
    }).pipe(
      map(() => ({
        message: 'If that email exists, a 6-digit code has been sent.',
      })),
    );
  }

  verifyResetCode(
    body: VerifyResetCodeRequest,
  ): Observable<VerifyResetCodeResponse> {
    // Verifying issues a short-lived reset-session cookie; there is no token in the body.
    return this.post<unknown>('/auth/verify-password-reset', {
      code: body.code,
    }).pipe(map(() => ({ resetToken: 'session' })));
  }

  resetPassword(
    body: ResetPasswordRequest,
  ): Observable<ResetPasswordResponse> {
    // The reset session is the cookie; only the new password is sent.
    return this.post<unknown>('/auth/reset-password', {
      password: body.password,
    }).pipe(map(() => ({ message: 'Password reset successfully.' })));
  }

  // ----- helpers -----

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiSuccess<T>>(`${this.base}${path}`, body, { withCredentials: true })
      .pipe(map((res) => res.data), catchError(normalizeError));
  }

  private get<T>(path: string): Observable<T> {
    return this.http
      .get<ApiSuccess<T>>(`${this.base}${path}`, { withCredentials: true })
      .pipe(map((res) => res.data), catchError(normalizeError));
  }
}

function normalizeError(err: HttpErrorResponse): Observable<never> {
  const body = err.error as
    | { error?: { code?: string; message?: string } }
    | undefined;
  return throwError(() => ({
    status: err.status,
    error: {
      code: body?.error?.code ?? 'ERROR',
      message: body?.error?.message ?? err.message ?? 'Request failed',
    },
  }));
}
