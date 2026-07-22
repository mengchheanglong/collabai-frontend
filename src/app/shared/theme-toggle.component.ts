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
      [attr.aria-label]="'Change color theme. Current theme: ' + theme.mode()"
      [title]="'Current theme: ' + theme.mode()"
    >
      <span class="material-symbols-rounded sm">
        {{ theme.mode() === 'dark' ? 'dark_mode' : theme.mode() === 'ocean' ? 'waves' : 'light_mode' }}
      </span>
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
