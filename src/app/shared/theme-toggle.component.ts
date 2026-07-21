import { Component, inject } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { ThemeService } from '../core/theme/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [MatRippleModule],
  template: `
    <button
      type="button"
      class="icon-btn theme-toggle"
      matRipple
      (click)="theme.toggle()"
      [attr.aria-label]="theme.mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      [title]="theme.mode() === 'dark' ? 'Light mode' : 'Dark mode'"
    >
      <span class="material-symbols-rounded sm">
        {{ theme.mode() === 'dark' ? 'light_mode' : 'dark_mode' }}
      </span>
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
