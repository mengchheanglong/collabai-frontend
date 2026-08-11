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
import type {
  ProjectMemberDto,
  ProjectRole,
} from '../api/api.types';

const AVATAR_COLORS = ['#3b82f6', '#06b6d4', '#22c55e', '#0ea5e9', '#f59e0b', '#ef4444', '#64748b'];

@Injectable({ providedIn: 'root' })
export class MemberDirectoryService {
  private readonly projectApi = inject(ProjectApiService);
  private readonly auth = inject(AuthStoreService);

  private readonly membersState = signal<Member[]>([]);
  /** The project whose members are shown (first project the user belongs to). */
  private readonly activeProjectId = signal<string | null>(null);

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
    this.loadFromApi();
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        Object.assign(this.currentUser, {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: initials(user.name),
          role: 'Member',
        });
        if (!this.membersState().length) this.loadFromApi();
      }
    });
  }

  /** Load the user's first project and its members from the backend. */
  private loadFromApi(): void {
    this.projectApi.list({ limit: 1 }).subscribe({
      next: ({ projects }) => {
        const first = projects[0];
        if (!first) return; // no projects yet -> empty roster
        this.activeProjectId.set(first._id);
        this.projectApi.listMembers(first._id).subscribe({
          next: (dtos) => this.membersState.set(dtos.map(toMember)),
          error: () => {
            /* leave roster empty; surfaced by the UI */
          },
        });
      },
      error: () => {
        /* not signed in / backend down -> empty roster */
      },
    });
  }

  initials(name: string): string {
    return initials(name);
  }

  memberColor(name: string): string {
    return this.membersState().find((m) => m.name === name)?.color ?? '#3b82f6';
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
        .subscribe({ error: () => this.reload() });
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
        .subscribe({ error: () => this.reload() });
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
        next: () => this.reload(), // replace the optimistic row with the real member
        error: () => this.reload(),
      });
    }
    return member;
  }

  private reload(): void {
    const projectId = this.activeProjectId();
    if (!projectId) return;
    this.projectApi.listMembers(projectId).subscribe({
      next: (dtos) => this.membersState.set(dtos.map(toMember)),
      error: () => {
        /* ignore */
      },
    });
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
