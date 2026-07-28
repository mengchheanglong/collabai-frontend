import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import type {
  AuthUser,
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

interface MockAccount {
  user: AuthUser;
  password: string;
  verified: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accounts = new Map<string, MockAccount>();
  private readonly tokenMap = new Map<string, string>();
  private readonly resetTokens = new Map<string, string>();
  private readonly resetCodes = new Map<string, string>();
  private readonly verifyCodes = new Map<string, string>();

  constructor() {
    const now = new Date('2026-01-01').toISOString();
    this.accounts.set('seoul@example.com', {
      user: {
        _id: 'user_seed_1',
        name: 'Seoul',
        email: 'seoul@example.com',
        avatarUrl: null,
        createdAt: now,
        updatedAt: now,
      },
      password: 'Password123!',
      verified: true,
    });
  }

  register(body: RegisterRequest): Observable<RegisterResponse> {
    const email = body.email.trim().toLowerCase();
    if (this.accounts.has(email)) {
      return throwError(() => ({
        error: { code: 'CONFLICT', message: 'Email already registered' },
      })).pipe(delay(600));
    }

    const now = new Date().toISOString();
    const user: AuthUser = {
      _id: this.mockToken(email),
      name: body.name.trim(),
      email,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(email, { user, password: body.password, verified: false });
    const accessToken = this.mockToken(email);
    this.tokenMap.set(accessToken, email);
    return of({ accessToken, user }).pipe(delay(800));
  }

  login(body: LoginRequest): Observable<LoginResponse> {
    const email = body.email.trim().toLowerCase();
    const account = this.accounts.get(email);
    if (!account || account.password !== body.password) {
      return throwError(() => ({
        error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
      })).pipe(delay(600));
    }

    const accessToken = this.mockToken(email);
    this.tokenMap.set(accessToken, email);
    return of({ accessToken, user: account.user }).pipe(delay(700));
  }

  logout(): Observable<null> {
    return of(null).pipe(delay(300));
  }

  me(token: string): Observable<MeResponse> {
    const email = this.tokenMap.get(token);
    if (!email) {
      return throwError(() => ({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' },
      })).pipe(delay(400));
    }

    const account = this.accounts.get(email);
    if (!account) {
      return throwError(() => ({
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      })).pipe(delay(400));
    }

    return of({ user: account.user }).pipe(delay(400));
  }

  forgotPassword(body: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    const email = body.email.trim().toLowerCase();
    if (this.accounts.has(email)) {
      const code = this.generateCode();
      this.resetCodes.set(email, code);
      // eslint-disable-next-line no-console
      console.info('[mock] password reset code for', email, '=', code);
    }
    return of({ message: 'If that email exists, a 6-digit code has been sent.' }).pipe(delay(800));
  }

  verifyResetCode(body: VerifyResetCodeRequest): Observable<VerifyResetCodeResponse> {
    const email = body.email.trim().toLowerCase();
    const expected = this.resetCodes.get(email);
    if (!expected || expected !== body.code) {
      return throwError(() => ({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or expired code' },
      })).pipe(delay(500));
    }

    this.resetCodes.delete(email);
    const resetToken = this.mockToken(email);
    this.resetTokens.set(resetToken, email);
    return of({ resetToken }).pipe(delay(500));
  }

  resetPassword(body: ResetPasswordRequest): Observable<ResetPasswordResponse> {
    const email = this.resetTokens.get(body.token);
    if (!email) {
      return throwError(() => ({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or expired reset token' },
      })).pipe(delay(500));
    }

    const account = this.accounts.get(email);
    if (!account) {
      return throwError(() => ({
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      })).pipe(delay(500));
    }

    account.password = body.password;
    this.resetTokens.delete(body.token);
    return of({ message: 'Password reset successfully' }).pipe(delay(600));
  }

  sendVerification(body: ResendVerificationRequest): Observable<ResendVerificationResponse> {
    const email = body.email.trim().toLowerCase();
    if (this.accounts.has(email)) {
      const code = this.generateCode();
      this.verifyCodes.set(email, code);
      // eslint-disable-next-line no-console
      console.info('[mock] verification code for', email, '=', code);
    }
    return of({ message: 'Verification code sent.' }).pipe(delay(700));
  }

  verifyEmail(body: VerifyEmailRequest): Observable<VerifyEmailResponse> {
    const email = body.email.trim().toLowerCase();
    const expected = this.verifyCodes.get(email);
    if (!expected || expected !== body.code) {
      return throwError(() => ({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or expired code' },
      })).pipe(delay(500));
    }

    const account = this.accounts.get(email);
    if (account) {
      account.verified = true;
      this.verifyCodes.delete(email);
    }
    return of({ message: 'Email verified. You can now log in.' }).pipe(delay(600));
  }

  private mockToken(email: string): string {
    return `${email}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
