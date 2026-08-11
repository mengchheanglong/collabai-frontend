import { Injectable, signal } from '@angular/core';

/** Shared visibility state for the global command palette. */
@Injectable({ providedIn: 'root' })
export class CommandCenterService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((isOpen) => !isOpen);
  }
}
