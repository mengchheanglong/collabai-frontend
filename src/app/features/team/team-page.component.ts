import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserApiService } from '../../core/api/user-api.service';
import type { UserDto } from '../../core/api/api.types';
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
export class TeamPageComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly userApi = inject(UserApiService);
  readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);

  readonly searchQuery = signal('');
  readonly roleFilter = signal<RoleFilter>('all');
  readonly menuOpenId = signal<string | null>(null);

  readonly inviteOpen = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteRole = signal<Member['role']>('Member');

  // Autocomplete state
  readonly searchSuggestions = signal<UserDto[]>([]);
  readonly isSearchingUsers = signal(false);
  readonly selectedUser = signal<UserDto | null>(null);
  private searchDebounceTimer: any = null;

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

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

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
    this.searchSuggestions.set([]);
  }

  setRoleFilter(filter: RoleFilter): void {
    this.roleFilter.set(filter);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.roleFilter.set('all');
  }

  openInvite(): void {
    if (this.workspace.activeProjectId && !this.workspace.activeProjectId()) {
      this.toast.error(
        'Please create or select a project from the sidebar first. Team members are invited to specific projects.',
        'No Project Selected',
      );
      return;
    }
    this.menuOpenId.set(null);
    this.inviteOpen.set(true);
  }

  closeInvite(): void {
    this.inviteOpen.set(false);
    this.inviteEmail.set('');
    this.inviteRole.set('Member');
    this.selectedUser.set(null);
    this.searchSuggestions.set([]);
    this.isSearchingUsers.set(false);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  onInviteInput(value: string): void {
    this.inviteEmail.set(value);
    if (this.selectedUser() && this.selectedUser()?.email !== value) {
      this.selectedUser.set(null);
    }

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    const term = value.trim();
    if (term.length < 2) {
      this.searchSuggestions.set([]);
      this.isSearchingUsers.set(false);
      return;
    }

    this.isSearchingUsers.set(true);
    this.searchDebounceTimer = setTimeout(() => {
      this.userApi.search(term).subscribe({
        next: (results) => {
          this.searchSuggestions.set(results || []);
          this.isSearchingUsers.set(false);
        },
        error: () => {
          this.searchSuggestions.set([]);
          this.isSearchingUsers.set(false);
        },
      });
    }, 250);
  }

  selectSuggestion(user: UserDto): void {
    this.selectedUser.set(user);
    this.inviteEmail.set(user.email);
    this.searchSuggestions.set([]);
  }

  clearSelectedUser(): void {
    this.selectedUser.set(null);
    this.inviteEmail.set('');
    this.searchSuggestions.set([]);
  }

  isAlreadyMember(email: string): boolean {
    const norm = email.trim().toLowerCase();
    return this.members.members().some((m) => m.email.toLowerCase() === norm);
  }

  sendInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) {
      this.toast.error('Please enter a valid email address before sending an invite.', 'Missing Email');
      return;
    }

    // The directory reports the outcome (one toast) once the server answers.
    const result = this.members.inviteMember(email, this.inviteRole());
    if (!result.ok) {
      this.toast.error(result.reason, 'Invite Failed');
      return;
    }
    this.closeInvite();
  }

  onRoleChange(member: Member, role: Member['role']): void {
    if (member.role === role) return;
    // The directory reports the outcome (one toast) once the server answers.
    const result = this.members.updateRole(member.id, role);
    if (!result.ok) this.toast.error(result.reason, 'Role Update Failed');
  }

  resendInvite(member: Member): void { this.members.resendInvitation(member); }
  revokeInvite(member: Member): void { this.members.revokeInvitation(member); }

  toggleMenu(event: Event, memberId: string): void {
    event.stopPropagation();
    this.menuOpenId.update((id) => (id === memberId ? null : memberId));
  }

  openRemoveDialog(event: Event, member: Member): void {
    event.stopPropagation();
    this.menuOpenId.set(null);

    if (member.id === this.members.currentUser.id) {
      this.toast.error("You can't remove yourself from the project here.", 'Action Restricted');
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
    if (!result.ok) this.toast.error(result.reason, 'Removal Failed');
  }

  /** Owners/admins may change other members' roles — never their own. */
  canChangeRole(member: Member): boolean {
    return (
      member.status !== 'Pending' &&
      !this.isYou(member) &&
      this.members.myRole() === 'Admin'
    );
  }

  roleLockReason(member: Member): string | null {
    if (this.isYou(member)) return "You can't change your own role";
    if (member.status === 'Pending') return 'Role can be changed after the invite is accepted';
    return null;
  }

  isYou(member: Member): boolean {
    return member.id === this.members.currentUser.id;
  }
}
