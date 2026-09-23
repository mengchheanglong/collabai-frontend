import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectApiService } from '../../core/api/project-api.service';
import { AuthStoreService } from '../../core/state/auth-store.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<main class="invite-accept"><h1>Project invitation</h1>
    @if (!auth.isAuthenticated()) { <p>Sign in with the invited email, or create that account first. After signing in, reopen this invitation link to accept.</p><a routerLink="/login">Sign in</a> <a routerLink="/signup">Create an account</a> }
    @else if (message()) { <p>{{ message() }}</p> @if (accepted()) { <a routerLink="/dashboard">Go to your projects</a> } }
    @else { <p>Accepting your invitation…</p> }
  </main>`,
  styles: [`.invite-accept{max-width:32rem;margin:12vh auto;padding:2rem;border-radius:1rem;background:var(--surface,#fff);color:var(--text,#222)}a{margin-right:1rem}`],
})
export class AcceptInviteComponent {
  readonly auth = inject(AuthStoreService);
  readonly message = signal('');
  readonly accepted = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ProjectApiService);

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) { this.message.set('This invitation link is missing its token. Ask the project admin to resend it.'); return; }
    if (!this.auth.isAuthenticated()) return;
    this.api.acceptInvitation(token).subscribe({
      next: () => { this.accepted.set(true); this.message.set('Invitation accepted. You now have access to the project.'); },
      error: (error) => this.message.set(error?.error?.message ?? 'This invitation is invalid, expired, or belongs to another email address.'),
    });
  }
}
