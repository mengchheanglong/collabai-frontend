import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'ai' | 'error';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  tone: ToastTone;
  duration: number;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly currentToast = signal<ToastMessage | null>(null);
  private timer: number | null = null;

  show(
    message: string,
    tone: ToastTone = 'info',
    title?: string,
    duration?: number,
  ): void {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    const resolvedDuration = duration ?? (tone === 'error' ? 4500 : 3600);
    const resolvedTitle =
      title ??
      (tone === 'success'
        ? 'Success'
        : tone === 'error'
          ? 'Failed'
          : tone === 'ai'
            ? 'CollabAI'
            : 'Notice');

    const toast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: resolvedTitle,
      message,
      tone,
      duration: resolvedDuration,
      timestamp: Date.now(),
    };

    this.currentToast.set(toast);

    this.timer = window.setTimeout(() => {
      this.dismiss(toast.id);
    }, resolvedDuration);
  }

  success(message: string, title = 'Success', duration = 3600): void {
    this.show(message, 'success', title, duration);
  }

  error(message: string, title = 'Failed', duration = 4500): void {
    this.show(message, 'error', title, duration);
  }

  info(message: string, title = 'Notice', duration = 3600): void {
    this.show(message, 'info', title, duration);
  }

  ai(message: string, title = 'CollabAI', duration = 4000): void {
    this.show(message, 'ai', title, duration);
  }

  dismiss(id?: string): void {
    if (!id || this.currentToast()?.id === id) {
      if (this.timer) {
        window.clearTimeout(this.timer);
        this.timer = null;
      }
      this.currentToast.set(null);
    }
  }

  /** Backward compatibility for any components directly reading toast() */
  readonly toast = this.currentToast;
}

