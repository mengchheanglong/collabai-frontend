import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import type { Member } from '../../shared/models/member.models';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

type RoleFilter = 'all' | Member['role'];

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [MatRippleModule, MatMenuModule, MatTooltipModule, ThemeToggleComponent],
  templateUrl: './team-page.component.html',
  styleUrl: './team-page.component.scss',
})
export class TeamPageComponent {
  private readonly toast = inject(ToastService);
  readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);

  readonly searchQuery = signal('');
  readonly roleFilter = signal<RoleFilter>('all');
  readonly menuOpenId = signal<string | null>(null);

  readonly inviteOpen = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteRole = signal<Member['role']>('Member');

  /** Member selected for destructive remove (dialog pattern). */
  readonly removeTarget = signal<Member | null>(null);

  readonly roles: Member['role'][] = ['Admin', 'Member', 'Viewer'];

  readonly nonAdminCount = computed(() => this.members.memberCount() - this.members.adminCount());

  readonly activeRate = computed(() =>
    Math.round((this.members.activeCount() / Math.max(this.members.memberCount(), 1)) * 100),
  );

  readonly filteredMembers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const role = this.roleFilter();
    return this.members.members().filter((m) => {
      if (role !== 'all' && m.role !== role) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      );
    });
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.removeTarget()) {
      this.closeRemoveDialog();
      return;
    }
    if (this.inviteOpen()) {
      this.closeInvite();
      return;
    }
    this.menuOpenId.set(null);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.menuOpenId.set(null);
  }

  setRoleFilter(filter: RoleFilter): void {
    this.roleFilter.set(filter);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.roleFilter.set('all');
  }

  openInvite(): void {
    this.menuOpenId.set(null);
    this.inviteOpen.set(true);
  }

  closeInvite(): void {
    this.inviteOpen.set(false);
    this.inviteEmail.set('');
    this.inviteRole.set('Member');
  }

  sendInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) {
      this.toast.error('Please enter a valid email address before sending an invite.', 'Missing Email');
      return;
    }

    const added = this.members.inviteMember(email, this.inviteRole());
    if (!added) {
      this.toast.error('That email is already on the team or cannot be added.', 'Invite Failed');
      return;
    }

    this.closeInvite();
    this.toast.success(`Successfully invited ${added.name} as ${this.inviteRole()}`, 'Invitation Sent');
  }

  onRoleChange(member: Member, role: Member['role']): void {
    if (member.role === role) return;
    const result = this.members.updateRole(member.id, role);
    if (!result.ok) {
      this.toast.error(result.reason, 'Role Update Failed');
      return;
    }
    this.toast.success(`${member.name}'s role was updated to ${role}`, 'Role Updated');
  }

  toggleMenu(event: Event, memberId: string): void {
    event.stopPropagation();
    this.menuOpenId.update((id) => (id === memberId ? null : memberId));
  }

  openRemoveDialog(event: Event, member: Member): void {
    event.stopPropagation();
    this.menuOpenId.set(null);

    if (member.id === this.members.currentUser.id) {
      this.toast.error("You cannot remove your own active account from the workspace.", 'Action Restricted');
      return;
    }

    this.removeTarget.set(member);
  }

  closeRemoveDialog(): void {
    this.removeTarget.set(null);
  }

  confirmRemove(): void {
    const member = this.removeTarget();
    if (!member) return;

    const result = this.members.removeMember(member.id);
    this.removeTarget.set(null);
    if (!result.ok) {
      this.toast.error(result.reason, 'Removal Failed');
      return;
    }
    this.toast.success(`${member.name} has been removed from this workspace`, 'Member Removed');
  }

  isYou(member: Member): boolean {
    return member.id === this.members.currentUser.id;
  }
}
