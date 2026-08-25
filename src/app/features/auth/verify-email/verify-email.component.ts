import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/api/auth.service';
import { ToastService } from '../../../core/toast/toast.service';
import { OtpInputComponent } from '../../../shared/ui/otp-input/otp-input.component';

type State = 'entering' | 'verifying' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [OtpInputComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: '../auth-pages.scss',
})
export class VerifyEmailComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly state = signal<State>('entering');
  readonly code = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly email = signal('');

  ngOnInit(): void {
    // Used only for display; the backend reads the email from the httpOnly
    // `registration_verification` cookie set during registration.
    this.email.set(this.route.snapshot.queryParamMap.get('email') ?? '');
  }

  onCodeChange(value: string): void {
    this.code.set(value);
    this.errorMessage.set(null);
  }

  submitCode(): void {
    if (this.code().length !== 6) return;
    this.state.set('verifying');
    this.auth
      .verifyEmail({ code: this.code(), email: this.email() || undefined })
      .subscribe({
        next: () => {
          this.toast.show('Email verified — you can now log in', 'success');
          void this.router.navigate(['/login']);
        },
        error: (err: unknown) => {
          // Stay on the form so the user can retry with a fresh code.
          this.state.set('entering');
          this.code.set('');
          this.errorMessage.set(
            (err as { error?: { error?: { message?: string } } })?.error?.error
              ?.message ?? 'Could not verify email',
          );
        },
      });
  }

  resendCode(): void {
    this.auth
      .resendVerification({ email: this.email() || undefined })
      .subscribe({
        next: () =>
          this.toast.show('A new verification code has been sent', 'success'),
        error: () =>
          this.toast.show(
            'Could not resend the code — please sign up again',
            'info',
          ),
      });
  }
}
