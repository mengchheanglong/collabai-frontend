import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/api/auth.service';
import { ToastService } from '../../../core/toast/toast.service';
import { OtpInputComponent } from '../../../shared/ui/otp-input/otp-input.component';

type State = 'entering' | 'verifying' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, OtpInputComponent],
  templateUrl: './verify-email.component.html',
})
export class VerifyEmailComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly state = signal<State>('entering');
  readonly code = signal('');
  readonly errorMessage = signal<string | null>(null);
  private email = '';

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (!email) {
      this.state.set('error');
      this.errorMessage.set('Missing email — please sign up again');
      return;
    }
    this.email = email;
  }

  onCodeChange(value: string): void {
    this.code.set(value);
    this.errorMessage.set(null);
  }

  submitCode(): void {
    if (this.code().length !== 6) return;
    this.auth.verifyEmail({ email: this.email, code: this.code() }).subscribe({
      next: () => this.state.set('success'),
      error: (err: unknown) => {
        this.errorMessage.set((err as any)?.error?.message ?? 'Could not verify email');
      },
    });
  }

  resendCode(): void {
    this.auth.sendVerification({ email: this.email }).subscribe({
      next: ({ message }) => this.toast.show(message, 'success'),
    });
  }
}
