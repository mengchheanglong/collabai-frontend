import { Component, inject, signal } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [MatRippleModule],
  templateUrl: './team-page.component.html',
})
export class TeamPageComponent {
  private readonly toast = inject(ToastService);
  readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);

  readonly inviteEmail = signal('');
  readonly inviteRole = signal('Member');

  sendInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) {
      this.toast.show('Enter an email', 'info');
      return;
    }
    this.inviteEmail.set('');
    this.toast.show(`Invite sent to ${email}`, 'success');
  }
}
