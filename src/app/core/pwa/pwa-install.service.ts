// src/app/core/pwa/pwa-install.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from '../toast/toast.service';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly toast = inject(ToastService);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal<boolean>(false);
  readonly isInstalled = signal<boolean>(false);
  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  init(): void {
    if (typeof window === 'undefined') return;

    // 1. Register Service Worker
    this.registerServiceWorker();

    // 2. Check if already running in standalone mode (PWA installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    this.isInstalled.set(isStandalone);

    // 3. Capture beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.isInstalled.set(true);
      this.toast.success('CollabAI was installed successfully!', 'App Installed');
    });

    // 4. Track Network Connectivity
    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.toast.success('Internet connection restored. Workspace synchronized.', 'Back Online');
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
      this.toast.info('You are currently offline. Cached workspace is active.', 'Offline Mode');
    });
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.canInstall.set(false);
        this.deferredPrompt = null;
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
      return false;
    }
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    }
  }
}
