import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'ai';

export interface ToastMessage {
  message: string;
  tone: ToastTone;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toast = signal<ToastMessage | null>(null);

  show(message: string, tone: ToastTone = 'info'): void {
    this.toast.set({ message, tone });
    window.setTimeout(() => {
      if (this.toast()?.message === message) {
        this.toast.set(null);
      }
    }, 2400);
  }
}
