import { Component, inject, signal } from '@angular/core';
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
<<<<<<< HEAD
    firstName: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(60)]],
=======
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

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
