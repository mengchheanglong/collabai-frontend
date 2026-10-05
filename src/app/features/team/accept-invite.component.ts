import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectApiService } from '../../core/api/project-api.service';
import { AuthStoreService } from '../../core/state/auth-store.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<main class="invite-accept">
    <div class="invite-card">
      <header class="invite-header">
        <h1>Project Invitation</h1>
      </header>

      <div class="invite-body">
        @if (!auth.isAuthenticated()) {
          <div class="invite-state is-auth-required">
            <p>Please sign in with the invited email, or create an account first. Once signed in, you will be able to join the project.</p>
            <div class="invite-actions">
              <a routerLink="/login" class="invite-btn primary">Sign in</a>
              <a routerLink="/signup" class="invite-btn ghost">Create account</a>
            </div>
          </div>
        } @else if (accepted()) {
          <div class="invite-state is-success">
            <span class="invite-icon success" aria-hidden="true">🎉</span>
            <p>{{ message() }}</p>
            <div class="invite-actions">
              <a [routerLink]="acceptedProjectId() ? ['/board', acceptedProjectId()] : '/board'" class="invite-btn primary">
                Go to Project Board
              </a>
              <a routerLink="/dashboard" class="invite-btn ghost">Dashboard</a>
            </div>
          </div>
        } @else if (isExpired()) {
          <div class="invite-state is-expired">
            <span class="invite-icon expired" aria-hidden="true">⏳</span>
            <h2>Invitation Expired</h2>
            <p>{{ message() }}</p>
            <p class="invite-subtext">Invitation links expire after 7 days for security. Please ask the project admin or owner to resend your invite.</p>
            <div class="invite-actions">
              <a routerLink="/dashboard" class="invite-btn primary">Go to Dashboard</a>
              <a routerLink="/" class="invite-btn ghost">Home</a>
            </div>
          </div>
        } @else if (message()) {
          <div class="invite-state is-error">
            <span class="invite-icon error" aria-hidden="true">⚠️</span>
            <p>{{ message() }}</p>
            <div class="invite-actions">
              <a routerLink="/dashboard" class="invite-btn ghost">Back to Dashboard</a>
            </div>
          </div>
        } @else {
          <div class="invite-state is-loading">
            <span class="invite-spinner" aria-hidden="true">🔄</span>
            <p>Accepting your project invitation…</p>
          </div>
        }
      </div>
    </div>
  </main>`,
  styles: [`
    .invite-accept {
      min-height: 80vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .invite-card {
      width: 100%;
      max-width: 30rem;
      background: var(--panel, #1e2230);
      border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
      border-radius: 1.25rem;
      padding: 2.25rem;
      box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.35);
      color: var(--text, #f1f5f9);
      text-align: center;
    }
    .invite-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
      letter-spacing: -0.02em;
    }
    .invite-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .invite-icon {
      font-size: 2.5rem;
      line-height: 1;
    }
    .invite-spinner {
      font-size: 2rem;
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .invite-subtext {
      font-size: 0.85rem;
      color: var(--muted, #94a3b8);
      max-width: 24rem;
      line-height: 1.5;
    }
    .invite-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 0.75rem;
      flex-wrap: wrap;
    }
    .invite-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.625rem 1.25rem;
      border-radius: 0.625rem;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.16s ease;
      cursor: pointer;
    }
    .invite-btn.primary {
      background: var(--brand, #6366f1);
      color: #fff;
    }
    .invite-btn.primary:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .invite-btn.ghost {
      background: var(--panel-2, rgba(255, 255, 255, 0.06));
      color: var(--text, #f1f5f9);
      border: 1px solid var(--line, rgba(255, 255, 255, 0.1));
    }
    .invite-btn.ghost:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  `],
})
export class AcceptInviteComponent {
  readonly auth = inject(AuthStoreService);
  readonly workspace = inject(WorkspaceContextService);
  readonly router = inject(Router);
  readonly message = signal('');
  readonly accepted = signal(false);
  readonly acceptedProjectId = signal<string | null>(null);
  readonly isExpired = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ProjectApiService);

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.message.set('This invitation link is missing its token. Ask the project admin to resend it.');
      return;
    }
    if (!this.auth.isAuthenticated()) return;

    this.api.acceptInvitation(token).subscribe({
      next: (res: any) => {
        this.accepted.set(true);
        this.message.set('Invitation accepted! You now have access to the project.');
        const projectId = res?.project?.id || res?.project?._id;
        if (projectId) {
          this.acceptedProjectId.set(projectId);
          if (this.workspace.selectProject) {
            this.workspace.selectProject(projectId);
          }
        }
      },
      error: (error) => {
        const msg = error?.error?.message ?? 'This invitation is invalid, expired, or belongs to another email address.';
        this.message.set(msg);
        if (msg.toLowerCase().includes('expired')) {
          this.isExpired.set(true);
        }
      },
    });
  }
}
