import { Injectable, computed, signal } from '@angular/core';
import { members as seedMembers } from '../../data/mock/mock-members';
import { initials } from '../../shared/lib/person-display';
import type { Member } from '../../shared/models/member.models';

const AVATAR_COLORS = ['#3b82f6', '#06b6d4', '#22c55e', '#a78bfa', '#f59e0b', '#ef4444', '#64748b'];

@Injectable({ providedIn: 'root' })
export class MemberDirectoryService {
  private readonly membersState = signal<Member[]>(seedMembers.map((m) => ({ ...m })));

  /** Reactive workspace roster. */
  readonly members = this.membersState.asReadonly();

  readonly memberCount = computed(() => this.membersState().length);

  readonly activeCount = computed(
    () => this.membersState().filter((m) => m.status === 'Active').length,
  );

  readonly adminCount = computed(
    () => this.membersState().filter((m) => m.role === 'Admin').length,
  );

  /** Mock signed-in user — always Seoul for MVP. */
  readonly currentUser: Member = seedMembers[0];

  initials(name: string): string {
    return initials(name);
  }

  memberColor(name: string): string {
    return this.membersState().find((m) => m.name === name)?.color ?? '#3b82f6';
  }

  /**
   * Change a member's workspace role (GitHub/Linear style inline role control).
   * Blocks demoting the last admin.
   */
  updateRole(
    memberId: string,
    role: Member['role'],
  ): { ok: true } | { ok: false; reason: string } {
    const target = this.membersState().find((m) => m.id === memberId);
    if (!target) {
      return { ok: false, reason: 'Member not found' };
    }

    if (target.role === 'Admin' && role !== 'Admin' && this.adminCount() <= 1) {
      return { ok: false, reason: 'Keep at least one admin' };
    }

    this.membersState.update((list) =>
      list.map((m) => (m.id === memberId ? { ...m, role } : m)),
    );
    return { ok: true };
  }

  /**
   * Remove a member from the workspace.
   * Current user cannot remove themselves. Last admin is protected.
   */
  removeMember(memberId: string): { ok: true } | { ok: false; reason: string } {
    if (memberId === this.currentUser.id) {
      return { ok: false, reason: "You can't remove yourself from here" };
    }

    const target = this.membersState().find((m) => m.id === memberId);
    if (!target) {
      return { ok: false, reason: 'Member not found' };
    }

    if (target.role === 'Admin' && this.adminCount() <= 1) {
      return { ok: false, reason: 'Keep at least one admin' };
    }

    this.membersState.update((list) => list.filter((m) => m.id !== memberId));
    return { ok: true };
  }

  inviteMember(email: string, role: Member['role']): Member | null {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return null;

    if (this.membersState().some((m) => m.email.toLowerCase() === normalized)) {
      return null;
    }

    const local = normalized.split('@')[0] || 'user';
    const name = local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'New member';

    const avatar = name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const member: Member = {
      id: `u-${Date.now()}`,
      name,
      email: normalized,
      role,
      avatar,
      status: 'Active',
      projects: 0,
      joined: 'Just now',
      color: AVATAR_COLORS[this.membersState().length % AVATAR_COLORS.length],
    };

    this.membersState.update((list) => [...list, member]);
    return member;
  }
}
