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
  private email = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submitEmail(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.email = this.form.getRawValue().email;
    this.isLoading.set(true);
    this.auth.forgotPassword({ email: this.email }).subscribe({
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
    this.auth.verifyResetCode({ email: this.email, code: this.code() }).subscribe({
      next: ({ resetToken }) => {
        this.isLoading.set(false);
        this.router.navigate(['/reset-password'], { queryParams: { token: resetToken } });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.codeError.set(err?.error?.message ?? 'Invalid code');
      },
    });
  }

  resendCode(): void {
    this.auth.forgotPassword({ email: this.email }).subscribe({
      next: ({ message }) => this.toast.show(message, 'success'),
    });
  }
}
