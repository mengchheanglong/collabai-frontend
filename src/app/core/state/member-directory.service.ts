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

  /** Change a member's role. Optimistic local update + PATCH to the backend. */
  updateRole(
    memberId: string,
    role: Member['role'],
  ): { ok: true } | { ok: false; reason: string } {
    const target = this.membersState().find((m) => m.id === memberId);
    if (!target) return { ok: false, reason: 'Member not found' };
    if (target.role === 'Admin' && role !== 'Admin' && this.adminCount() <= 1) {
      return { ok: false, reason: 'Keep at least one admin' };
    }

    this.membersState.update((list) =>
      list.map((m) => (m.id === memberId ? { ...m, role } : m)),
    );

    const projectId = this.activeProjectId();
    if (projectId) {
      this.projectApi
        .updateMemberRole(projectId, memberId, toBackendRole(role))
        .subscribe({
          next: () => this.toast.show('Role updated', 'success'),
          error: () => {
            this.toast.show('Failed to update role', 'info');
            this.reload();
          },
        });
    }
    return { ok: true };
  }

  /** Remove a member. Optimistic local remove + DELETE to the backend. */
  removeMember(memberId: string): { ok: true } | { ok: false; reason: string } {
    if (memberId === this.currentUser.id) {
      return { ok: false, reason: "You can't remove yourself from here" };
    }
    const target = this.membersState().find((m) => m.id === memberId);
    if (!target) return { ok: false, reason: 'Member not found' };
    if (target.role === 'Admin' && this.adminCount() <= 1) {
      return { ok: false, reason: 'Keep at least one admin' };
    }

    this.membersState.update((list) => list.filter((m) => m.id !== memberId));

    const projectId = this.activeProjectId();
    if (projectId) {
      this.projectApi
        .removeMember(projectId, memberId)
        .subscribe({
          next: () => this.toast.show('Member removed', 'success'),
          error: () => {
            this.toast.show('Failed to remove member', 'info');
            this.reload();
          },
        });
    }
    return { ok: true };
  }

  /** Invite by email. Optimistic local add + POST to the backend. */
  inviteMember(email: string, role: Member['role']): Member | null {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return null;
    if (this.membersState().some((m) => m.email.toLowerCase() === normalized)) {
      return null;
    }

    const local = normalized.split('@')[0] || 'user';
    const name =
      local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'New member';

    const member: Member = {
      id: `pending-${Date.now()}`,
      name,
      email: normalized,
      role,
      avatar: initials(name),
      status: 'Active',
      projects: 0,
      joined: 'Just now',
      color: AVATAR_COLORS[this.membersState().length % AVATAR_COLORS.length],
    };
    this.membersState.update((list) => [...list, member]);

    const projectId = this.activeProjectId();
    if (projectId) {
      const backendRole = toBackendRole(role) as Exclude<ProjectRole, 'owner'>;
      this.projectApi.addMember(projectId, normalized, backendRole).subscribe({
        next: () => {
          this.toast.show(`Added ${name} to team`, 'success');
          this.reload(); // replace the optimistic row with the real member
        },
        error: () => {
          this.toast.show('Failed to add member', 'info');
          this.reload();
        },
      });
    }
    return member;
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

function toMember(dto: ProjectMemberDto, index: number): Member {
  return {
    id: dto.userId,
    name: dto.name,
    email: dto.email,
    role: toUiRole(dto.role),
    avatar: initials(dto.name),
    status: 'Active',
    projects: 0,
    joined: dto.joinedAt ? new Date(dto.joinedAt).toLocaleDateString() : '',
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
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
