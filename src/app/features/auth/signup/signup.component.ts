import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStoreService } from '../../../core/state/auth-store.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: '../auth-pages.scss',
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  readonly authStore = inject(AuthStoreService);

  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly password = computed(() => this.form.controls.password.value ?? '');

  readonly passwordStrength = computed(() => {
    const pw = this.password();
    if (!pw) return { score: 0, label: '', color: '', hasLen: false, hasCase: false, hasNum: false, hasSpecial: false };

    let score = 0;
    const hasLen = pw.length >= 8;
    const hasCase = /[A-Z]/.test(pw) && /[a-z]/.test(pw);
    const hasNum = /[0-9]/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);

    if (hasLen) score++;
    if (hasCase) score++;
    if (hasNum) score++;
    if (hasSpecial) score++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['', 'pw-weak', 'pw-fair', 'pw-good', 'pw-strong'];

    return {
      score,
      label: labels[score] ?? '',
      color: colors[score] ?? '',
      hasLen,
      hasCase,
      hasNum,
      hasSpecial,
    };
  });

  isValid(controlName: 'firstName' | 'lastName' | 'email' | 'password'): boolean {
    const ctrl = this.form.get(controlName);
    return !!ctrl && ctrl.valid && ctrl.touched;
  }

  isInvalid(controlName: 'firstName' | 'lastName' | 'email' | 'password'): boolean {
    const ctrl = this.form.get(controlName);
    return !!ctrl && ctrl.invalid && ctrl.touched;
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  submit(): void {
    this.authStore.clearAuthError();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { firstName, lastName, email, password } = this.form.getRawValue();
    this.authStore.register(firstName, lastName, email, password);
  }
}
