// src/app/core/state/member-directory.service.ts
//
// Workspace member roster. NOW BACKED BY THE API: on startup it loads the current user's
// first project and its members from the backend (mapping ProjectMemberDto -> Member), and
// invite/role/remove call the real projects/members endpoints. The public interface
// (signals + method signatures) is unchanged so the Team page keeps working; mutations are
// applied optimistically and fired to the API (report any error and it can be reconciled).

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { initials } from '../../shared/lib/person-display';
import type { Member } from '../../shared/models/member.models';
import { ProjectApiService } from '../api/project-api.service';
import { AuthStoreService } from './auth-store.service';
import { ToastService } from '../toast/toast.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import type {
  ProjectMemberDto,
  ProjectRole,
} from '../api/api.types';
import { VIEW_ONLY_MESSAGE, apiErrorMessage } from '../api/api-error';

const AVATAR_COLORS = ['#3b82f6', '#06b6d4', '#22c55e', '#0ea5e9', '#f59e0b', '#ef4444', '#64748b'];

@Injectable({ providedIn: 'root' })
export class MemberDirectoryService {
  private readonly projectApi = inject(ProjectApiService);
  private readonly auth = inject(AuthStoreService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly toast = inject(ToastService);

  private readonly membersState = signal<Member[]>([]);
  /** The project whose members are currently shown, tracked reactively. */
  readonly activeProjectId = computed(() => this.workspace.activeProjectId());

  /** Reactive workspace roster. */
  readonly members = this.membersState.asReadonly();

  readonly memberCount = computed(() => this.membersState().length);

  readonly activeCount = computed(
    () => this.membersState().filter((m) => m.status === 'Active').length,
  );

  readonly adminCount = computed(
    () => this.membersState().filter((m) => m.role === 'Admin').length,
  );

  /**
   * Signed-in user — hydrated from the auth store (guest defaults until login).
   * Kept as a plain object so templates can keep reading `currentUser.name` etc.
   */
  readonly currentUser: Member = {
    id: '',
    name: 'Guest User',
    email: 'Not signed in',
    role: 'Member',
    avatar: '',
    status: 'Active',
    projects: 0,
    joined: '',
    color: AVATAR_COLORS[0],
  };

  constructor() {
    effect(() => {
      const projectId = this.workspace.activeProjectId();
      if (projectId) {
        this.loadMembersForProject(projectId);
      } else {
        this.membersState.set([]);
      }
    });

    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        Object.assign(this.currentUser, {
          id: user._id || (user as any).id,
          name: user.name,
          email: user.email,
          avatar: initials(user.name),
          avatarUrl: user.avatarUrl ?? null,
          role: 'Member',
        });
      }
    });
  }

  /** Load members for the given project from the backend. */
  private loadMembersForProject(projectId: string): void {
    this.projectApi.listMembers(projectId).subscribe({
      next: (dtos) => {
        const list = dtos.map(toMember);
        // Merge the current user's avatarUrl into the member list
        const myId = this.currentUser.id;
        if (myId) {
          const avatarUrl = this.currentUser.avatarUrl;
          for (const m of list) {
            if (m.id === myId) m.avatarUrl = avatarUrl;
          }
        }
        this.membersState.set(list);
      },
      error: () => {
        this.membersState.set([]);
      },
    });
  }

  initials(idOrName: string): string {
    if (!idOrName) return '—';
    const member = this.membersState().find((m) => m.id === idOrName || m.name === idOrName);
    return initials(member ? member.name : idOrName);
  }

  memberColor(idOrName: string): string {
    if (!idOrName) return '#94a3b8';
    return (
      this.membersState().find((m) => m.id === idOrName || m.name === idOrName)?.color ??
      '#3b82f6'
    );
  }

  memberName(idOrName: string): string {
    if (!idOrName) return 'Unassigned';
    return (
      this.membersState().find((m) => m.id === idOrName || m.name === idOrName)?.name ?? idOrName
    );
  }

  memberAvatarUrl(idOrName: string): string | null {
    if (!idOrName) return null;
    const m = this.membersState().find((m) => m.id === idOrName || m.name === idOrName);
    return m?.avatarUrl ?? null;
  }

  updateCurrentUserProfile(
    input: Pick<Member, 'name' | 'email'>,
  ): { ok: true } | { ok: false; reason: string } {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();

    if (name.length < 2 || name.length > 80) {
      return { ok: false, reason: 'Name must be between 2 and 80 characters.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return { ok: false, reason: 'Enter a valid email address.' };
    }

    const avatar = initials(name);
    Object.assign(this.currentUser, { name, email, avatar });
    this.membersState.update((list) =>
      list.map((member) =>
        member.id === this.currentUser.id ? { ...member, name, email, avatar } : member,
      ),
    );
    return { ok: true };
  }

  /** False for viewers. Unknown role (still loading) is allowed — the server enforces anyway. */
  canEditContent(): boolean {
    return this.myRole() !== 'Viewer';
  }

  /** For every content-changing action: shows the view-only message and returns false for viewers. */
  ensureCanEdit(): boolean {
    if (this.canEditContent()) return true;
    this.toast.error(VIEW_ONLY_MESSAGE, 'View Only');
    return false;
  }

  /**
   * Whether the signed-in user may change a task's assignee away from `current`
   * (null = unassigned). Owners/admins: always. Members: only an unassigned task or
   * their own (take it / remove themselves). Viewers: never. Mirrors the backend rule.
   */
  canChangeAssignee(current: string | null): boolean {
    if (this.myRole() === 'Admin') return true;
    if (!this.canEditContent()) return false;
    return current === null || current === this.currentUser.id;
  }

  /** People who may be picked as assignee when the task is currently assigned to `current`. */
  assigneeOptions(current: string | null): Member[] {
    const active = this.membersState().filter((m) => m.status !== 'Pending');
    if (this.myRole() === 'Admin') return active;
    if (!this.canChangeAssignee(current)) return [];
    return active.filter((m) => m.id === this.currentUser.id);
  }

  /** The signed-in user's role in the active project (owners show as Admin), if loaded. */
  myRole(): Member['role'] | null {
    return this.membersState().find((m) => m.id === this.currentUser.id)?.role ?? null;
  }

  /**
   * Change a member's role. Rules the client can see are checked up front; otherwise the
   * change is applied only once the server confirms, with exactly one toast either way
   * (the server's reason on refusal — e.g. only the owner may grant admin).
   */
  updateRole(
    memberId: string,
    role: Member['role'],
  ): { ok: true } | { ok: false; reason: string } {
    const target = this.membersState().find((m) => m.id === memberId);
    if (!target) return { ok: false, reason: 'Member not found.' };
    if (memberId === this.currentUser.id) {
      return { ok: false, reason: "You can't change your own role. Ask a project owner to do it." };
    }
    if (this.myRole() !== 'Admin') {
      return { ok: false, reason: 'Only project owners and admins can change member roles.' };
    }
    const projectId = this.activeProjectId();
    if (!projectId) return { ok: false, reason: 'Select a project first.' };

    this.projectApi
      .updateMemberRole(projectId, memberId, toBackendRole(role))
      .subscribe({
        next: () => {
          this.membersState.update((list) =>
            list.map((m) => (m.id === memberId ? { ...m, role } : m)),
          );
          this.toast.success(`${target.name}'s role was updated to ${role}.`, 'Role Updated');
        },
        error: (err: unknown) => {
          this.toast.error(
            apiErrorMessage(err, 'Could not update the role. Please try again.'),
            'Role Update Failed',
          );
        },
      });
    return { ok: true };
  }

  /**
   * Remove a member. Applied once the server confirms, with one toast either way
   * (the server's reason on refusal — e.g. only the owner may remove an admin).
   */
  removeMember(memberId: string): { ok: true } | { ok: false; reason: string } {
    if (memberId === this.currentUser.id) {
      return { ok: false, reason: "You can't remove yourself from the project here." };
    }
    const target = this.membersState().find((m) => m.id === memberId);
    if (!target) return { ok: false, reason: 'Member not found.' };
    if (this.myRole() !== 'Admin') {
      return { ok: false, reason: 'Only project owners and admins can remove members.' };
    }
    const projectId = this.activeProjectId();
    if (!projectId) return { ok: false, reason: 'Select a project first.' };

    this.projectApi.removeMember(projectId, memberId).subscribe({
      next: () => {
        this.membersState.update((list) => list.filter((m) => m.id !== memberId));
        this.toast.success(`${target.name} was removed from the project.`, 'Member Removed');
      },
      error: (err: unknown) =>
        this.toast.error(
          apiErrorMessage(err, 'Could not remove the member. Please try again.'),
          'Removal Failed',
        ),
    });
    return { ok: true };
  }

  /**
   * Invite by email. Existing users are added straight away; anyone else gets an
   * invitation email. One toast once the server answers, saying which happened.
   */
  inviteMember(email: string, role: Member['role']): { ok: true } | { ok: false; reason: string } {
    const projectId = this.activeProjectId();
    if (!projectId) {
      return { ok: false, reason: 'Create or select a project from the sidebar first.' };
    }
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { ok: false, reason: 'Enter a valid email address.' };
    }
    const existing = this.membersState().find((m) => m.email.toLowerCase() === normalized);
    if (existing) {
      return {
        ok: false,
        reason:
          existing.status === 'Pending'
            ? `${normalized} already has a pending invitation. Use Resend instead.`
            : `${existing.name} is already on the team.`,
      };
    }
    if (this.myRole() !== 'Admin') {
      return { ok: false, reason: 'Only project owners and admins can invite members.' };
    }

    const backendRole = toBackendRole(role) as Exclude<ProjectRole, 'owner'>;
    this.projectApi.addMember(projectId, normalized, backendRole).subscribe({
      next: (project: { members?: Array<{ email?: string; name?: string }> }) => {
        const added = project?.members?.find((m) => m.email?.toLowerCase() === normalized);
        if (added) {
          this.toast.success(`${added.name || normalized} was added to the team as ${role}.`, 'Member Added');
        } else {
          this.toast.success(
            `Invitation sent to ${normalized}. They'll join as ${role} after creating their account.`,
            'Invitation Sent',
          );
        }
        this.reload();
      },
      error: (err: unknown) =>
        this.toast.error(
          apiErrorMessage(err, 'Could not send the invitation. Please try again.'),
          'Invite Failed',
        ),
    });
    return { ok: true };
  }

  refreshMembers(): void { this.reload(); }

  resendInvitation(member: Member): void {
    const projectId = this.activeProjectId();
    if (!projectId || !member.invitationId) return;
    this.projectApi.resendInvitation(projectId, member.invitationId).subscribe({
      next: () =>
        this.toast.success(`A new invitation link was sent to ${member.email}.`, 'Invitation Resent'),
      error: (err: unknown) => {
        this.toast.error(
          apiErrorMessage(err, 'Could not resend the invitation. Please try again.'),
          'Resend Failed',
        );
        this.reload(); // e.g. it was accepted meanwhile — refresh the list
      },
    });
  }

  revokeInvitation(member: Member): void {
    const projectId = this.activeProjectId();
    if (!projectId || !member.invitationId) return;
    this.projectApi.revokeInvitation(projectId, member.invitationId).subscribe({
      next: () => {
        this.toast.success(`The invitation to ${member.email} was revoked.`, 'Invitation Revoked');
        this.reload();
      },
      error: (err: unknown) =>
        this.toast.error(
          apiErrorMessage(err, 'Could not revoke the invitation. Please try again.'),
          'Revoke Failed',
        ),
    });
  }

  private reload(): void {
    const projectId = this.activeProjectId();
    if (!projectId) {
      this.membersState.set([]);
      return;
    }
    this.loadMembersForProject(projectId);
  }
}

// ----- mapping: contract DTO <-> component model -----

function formatExpiration(expiresAt?: string | null): { label?: string; isExpired: boolean } {
  if (!expiresAt) return { isExpired: false };
  const target = new Date(expiresAt).getTime();
  const now = Date.now();
  if (target <= now) {
    return { label: 'Expired', isExpired: true };
  }
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) {
    const diffHours = Math.max(1, Math.ceil((target - now) / (1000 * 60 * 60)));
    return { label: diffHours <= 1 ? 'Expires in <1h' : `Expires in ${diffHours}h`, isExpired: false };
  }
  return { label: `Expires in ${diffDays} days`, isExpired: false };
}

function toMember(dto: ProjectMemberDto, index: number): Member {
  const exp = dto.pending ? formatExpiration(dto.invitationExpiresAt) : { isExpired: false };
  return {
    id: dto.userId ?? `invitation-${dto.invitationId}`,
    name: dto.name,
    email: dto.email,
    role: toUiRole(dto.role),
    avatar: initials(dto.name),
    status: dto.pending ? 'Pending' : 'Active',
    projects: 0,
    joined: dto.joinedAt ? new Date(dto.joinedAt).toLocaleDateString() : '',
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
    invitationId: dto.invitationId,
    invitationExpiresAt: dto.invitationExpiresAt ?? null,
    expiresInLabel: exp.label,
    isExpired: exp.isExpired,
  };
}

function toUiRole(role: ProjectRole): Member['role'] {
  if (role === 'owner' || role === 'admin') return 'Admin';
  if (role === 'viewer') return 'Viewer';
  return 'Member';
}

function toBackendRole(role: Member['role']): ProjectRole {
  if (role === 'Admin') return 'admin';
  if (role === 'Viewer') return 'viewer';
  return 'member';
}
