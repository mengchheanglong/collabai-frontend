import { Component, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { AuthStoreService } from '../../core/state/auth-store.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import { ToastService } from '../../core/toast/toast.service';
import { PushNotificationService } from '../../core/pwa/push-notification.service';
import { PwaInstallService } from '../../core/pwa/pwa-install.service';

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
  imports: [ReactiveFormsModule, RouterLink, MatRippleModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent {
  private readonly themeService = inject(ThemeService);
  private readonly memberDirectory = inject(MemberDirectoryService);
  private readonly authStore = inject(AuthStoreService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly push = inject(PushNotificationService);
  readonly pwa = inject(PwaInstallService);

  @ViewChild('avatarInput') avatarInput?: ElementRef<HTMLInputElement>;

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

  readonly avatarPreview = signal<string | null>(null);
  readonly isUploadingAvatar = signal(false);

  get displayAvatarUrl(): string | null {
    return this.avatarPreview() ?? this.currentUser.avatarUrl ?? null;
  }

  triggerAvatarUpload(): void {
    this.avatarInput?.nativeElement.click();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.toast.show('Please select a JPEG, PNG, GIF, or WebP image', 'info');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.show('Image must be smaller than 5 MB', 'info');
      return;
    }

    // Resize and compress the image, then show preview
    this.resizeImage(file, 256, 256).then((dataUrl) => {
      this.avatarPreview.set(dataUrl);
    });

    // Reset input so re-selecting the same file triggers change
    input.value = '';
  }

  saveAvatar(): void {
    const dataUrl = this.avatarPreview();
    if (!dataUrl) return;
    this.isUploadingAvatar.set(true);
    this.authStore.updateProfile({ avatarUrl: dataUrl });
    setTimeout(() => {
      this.isUploadingAvatar.set(false);
      this.avatarPreview.set(null);
      this.toast.show('Profile picture updated', 'success');
    }, 500);
  }

  private resizeImage(file: File, maxW: number, maxH: number): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  logout(): void {
    this.authStore.logout();
  }
}
