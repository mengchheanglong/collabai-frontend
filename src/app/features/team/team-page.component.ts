import { Component, inject, signal } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [MatRippleModule, ThemeToggleComponent],
  templateUrl: './team-page.component.html',
})
export class TeamPageComponent {
  private readonly toast = inject(ToastService);
  readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);

  readonly displayedMembers = signal([...this.members.members]);
  readonly isInviteOpen = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteRole = signal('Member');

  openInvite(): void {
    this.isInviteOpen.set(true);
  }

  closeInvite(): void {
    this.isInviteOpen.set(false);
  }

  removeMember(memberId: string): void {
    const member = this.displayedMembers().find((item) => item.id === memberId);
    if (!member) {
      return;
    }

    this.displayedMembers.update((items) => items.filter((item) => item.id !== memberId));
    this.toast.show(`${member.name} removed from team`, 'success');
  }

  sendInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) {
      this.toast.show('Enter an email', 'info');
      return;
    }
    this.inviteEmail.set('');
    this.closeInvite();
    this.toast.show(`Invite sent to ${email}`, 'success');
  }
}
