import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/api/auth.service';
import { ToastService } from '../../../core/toast/toast.service';
import { OtpInputComponent } from '../../../shared/ui/otp-input/otp-input.component';

type Stage = 'email' | 'code';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, OtpInputComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: '../auth-pages.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly stage = signal<Stage>('email');
  readonly isLoading = signal(false);
  readonly code = signal('');
  readonly codeError = signal<string | null>(null);
  readonly submittedEmail = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submitEmail(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.getRawValue().email;
    this.submittedEmail.set(email);
    this.isLoading.set(true);
    this.auth.forgotPassword({ email }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.stage.set('code');
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Something went wrong. Try again.', 'info');
      },
    });
  }

  onCodeChange(value: string): void {
    this.code.set(value);
    this.codeError.set(null);
  }

  submitCode(): void {
    if (this.code().length !== 6) return;
    this.isLoading.set(true);
    this.auth.verifyResetCode({ code: this.code() }).subscribe({
      next: () => {
        this.isLoading.set(false);
        // The backend swaps the verification cookie for the short-lived
        // `password_reset_session` cookie — no token param needed.
        void this.router.navigate(['/reset-password']);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        this.codeError.set(
          (err as { error?: { error?: { message?: string } } })?.error?.error?.message ??
            'Invalid code',
        );
      },
    });
  }

  resendCode(): void {
    this.auth.forgotPassword({ email: this.submittedEmail() }).subscribe({
      next: () => this.toast.show('A new reset code has been sent', 'success'),
      error: () => this.toast.show('Something went wrong. Try again.', 'info'),
    });
  }
}
