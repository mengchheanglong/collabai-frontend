import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';

interface ThemeOption {
  value: ThemeMode;
  label: string;
  hint: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent {
  private readonly themeService = inject(ThemeService);
  private readonly memberDirectory = inject(MemberDirectoryService);
  private readonly formBuilder = inject(FormBuilder);

  readonly currentUser = this.memberDirectory.currentUser;
  readonly workspace = inject(WorkspaceContextService);
  readonly isEditing = signal(false);
  readonly profileMessage = signal('');
  readonly profileMessageTone = signal<'success' | 'error'>('success');
  readonly profileForm = this.formBuilder.nonNullable.group({
    name: [
      this.currentUser.name,
      [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    ],
    email: [
      this.currentUser.email,
      [Validators.required, Validators.email, Validators.maxLength(254)],
    ],
  });
  readonly themeMode = this.themeService.mode;
  readonly themeOptions: readonly ThemeOption[] = [
    {
      value: 'light',
      label: 'Light',
      hint: 'Clean and familiar',
      description: 'Bright neutral surfaces for daytime work.',
      icon: 'light_mode',
    },
    {
      value: 'dark',
      label: 'Dark',
      hint: 'Focused and calm',
      description: 'Low-glare contrast for long planning sessions.',
      icon: 'dark_mode',
    },
    {
      value: 'ocean',
      label: 'Ocean',
      hint: 'Cool and refreshing',
      description: 'Soft blue surfaces with clear, deep-blue text.',
      icon: 'waves',
    },
  ];
  readonly activeThemeLabel = computed(
    () => this.themeOptions.find((option) => option.value === this.themeMode())?.label ?? 'Theme',
  );

  handleThemeChange(next: ThemeMode): void {
    this.themeService.mode.set(next);
  }

  startEditing(): void {
    this.profileForm.reset({
      name: this.currentUser.name,
      email: this.currentUser.email,
    });
    this.profileMessage.set('');
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.profileForm.reset({
      name: this.currentUser.name,
      email: this.currentUser.email,
    });
    this.profileMessage.set('');
    this.isEditing.set(false);
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.profileMessageTone.set('error');
      this.profileMessage.set('Check the highlighted fields and try again.');
      return;
    }

    const result = this.memberDirectory.updateCurrentUserProfile(this.profileForm.getRawValue());
    if (!result.ok) {
      this.profileMessageTone.set('error');
      this.profileMessage.set(result.reason);
      return;
    }

    this.profileForm.reset({
      name: this.currentUser.name,
      email: this.currentUser.email,
    });
    this.profileMessageTone.set('success');
    this.profileMessage.set('Profile information updated.');
    this.isEditing.set(false);
  }
}
