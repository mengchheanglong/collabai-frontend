import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * CollabAI brand logo — inline custom SVG mark + wordmark.
 *
 * Custom vector logo mark designed specifically for CollabAI:
 * An interconnected collaborative "C" ribbon with team member synergy nodes
 * and a radiant central AI sparkle core.
 *
 * Usage:
 *   <app-logo />                // default size (sidebar header)
 *   <app-logo size="lg" />      // auth pages
 *   <app-logo [markOnly]="true" /> // collapsed sidebar / favicon-style
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="brand-logo" [class]="size()" [class.mark-only]="markOnly()">
      <svg
        class="brand-mark"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="collab-primary-grad" x1="7" y1="5" x2="33" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="45%" stop-color="#2563eb"/>
            <stop offset="100%" stop-color="#7c3aed"/>
          </linearGradient>
          <linearGradient id="collab-spark-grad" x1="20" y1="8" x2="30" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#67e8f9"/>
            <stop offset="100%" stop-color="#3b82f6"/>
          </linearGradient>
        </defs>

        <!-- Outer Collaboration Ribbon (Letter 'C') -->
        <path
          d="M 28 8.5 C 16.5 5 7 12 7 20 C 7 28 16.5 35 28 31.5"
          stroke="url(#collab-primary-grad)"
          stroke-width="4.2"
          stroke-linecap="round"
        />

        <!-- Collaborative Team Nodes -->
        <circle cx="28" cy="8.5" r="3" fill="#38bdf8"/>
        <circle cx="28" cy="31.5" r="3" fill="#7c3aed"/>
        <circle cx="7" cy="20" r="2.2" fill="#2563eb"/>

        <!-- Central AI Sparkle Core -->
        <path
          d="M 25 20 C 25 16.8 26.8 14 30 14 C 26.8 14 25 11.2 25 8 C 25 11.2 23.2 14 20 14 C 23.2 14 25 16.8 25 20 Z"
          fill="url(#collab-spark-grad)"
        />

        <!-- Secondary AI Accent -->
        <path
          d="M 21 27 C 21 25.3 21.9 24 23.2 24 C 21.9 24 21 22.7 21 21 C 21 22.7 20.1 24 18.8 24 C 20.1 24 21 25.3 21 27 Z"
          fill="#818cf8"
        />
      </svg>
      @if (!markOnly()) {
        <span class="brand-name">Collab&#8202;<span class="brand-ai">AI</span></span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      color: var(--text, currentColor);
    }

    .brand-logo {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      line-height: 1;
      color: inherit;
      white-space: nowrap;
    }

    .brand-mark {
      height: 30px;
      width: auto;
      flex-shrink: 0;
      display: block;
    }

    .brand-name {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 21px;
      letter-spacing: -0.02em;
      color: var(--text, currentColor);
    }

    .brand-ai {
      color: var(--brand);
      font-weight: 800;
    }

    /* Sizes */
    .sm .brand-mark { height: 22px; }
    .sm .brand-name { font-size: 15.5px; }
    .sm { gap: 7px; }

    .lg .brand-mark { height: 36px; }
    .lg .brand-name { font-size: 25px; }

    .mark-only { gap: 0; }
    .mark-only .brand-mark { height: 30px; }
  `,
})
export class LogoComponent {
  /** Visual size preset. */
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  /** Render only the mark (collapsed sidebar, buttons). */
  readonly markOnly = input(false);
}
