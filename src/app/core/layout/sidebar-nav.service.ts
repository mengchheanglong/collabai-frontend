import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SidebarNavStateService {
  /** Reactive state for whether the main left navigation sidebar is collapsed. */
  readonly isCollapsed = signal(false);

  toggle(): void {
    this.isCollapsed.update(state => !state);
  }

  setCollapsed(collapsed: boolean): void {
    this.isCollapsed.set(collapsed);
  }
}
