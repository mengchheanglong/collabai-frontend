import { Injectable } from '@angular/core';
import { members } from '../../data/mock/mock-members';
import { initials } from '../../shared/lib/person-display';
import type { Member } from '../../shared/models/member.models';

@Injectable({ providedIn: 'root' })
export class MemberDirectoryService {
  readonly members: Member[] = members;
  readonly currentUser: Member = members[0];

  initials(name: string): string {
    return initials(name);
  }

  memberColor(name: string): string {
    return this.members.find((m) => m.name === name)?.color ?? '#3b82f6';
  }
}
