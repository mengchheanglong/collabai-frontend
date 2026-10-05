// Runs the real MemberDirectoryService permission checks with a signed-in user, the way
// the task drawer uses them (owner/admin, assignee, other member, viewer, unassigned).
import '@angular/compiler';
import assert from 'node:assert/strict';
import { DOCUMENT } from '@angular/common';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of } from 'rxjs';
import { MemberDirectoryService } from '../src/app/core/state/member-directory.service';
import { AuthStoreService } from '../src/app/core/state/auth-store.service';
import { WorkspaceContextService } from '../src/app/core/workspace/workspace-context.service';
import { ProjectApiService } from '../src/app/core/api/project-api.service';
import { ToastService } from '../src/app/core/toast/toast.service';

const members = [
  { userId: 'owner-1', role: 'owner', name: 'tra bot', email: 'tra@example.com' },
  { userId: 'member-1', role: 'member', name: 'Mike', email: 'mike@example.com' },
  { userId: 'member-2', role: 'member', name: 'Lina', email: 'lina@example.com' },
  { userId: 'viewer-1', role: 'viewer', name: 'Vee', email: 'vee@example.com' },
];

async function signedInAs(userId: string): Promise<MemberDirectoryService> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: DOCUMENT, useValue: {} },
      { provide: AuthStoreService, useValue: { currentUser: signal({ _id: userId, name: userId, email: '' }) } },
      { provide: WorkspaceContextService, useValue: { activeProjectId: signal('project-1') } },
      { provide: ProjectApiService, useValue: { listMembers: () => of(members) } },
      { provide: ToastService, useValue: { error: () => {}, success: () => {}, show: () => {} } },
    ],
  });
  const directory = TestBed.inject(MemberDirectoryService);
  TestBed.tick(); // run effects: load members + hydrate the signed-in user
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.tick();
  return directory;
}

async function main(): Promise<void> {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

  // Owner (shown as Admin) assigned to the task — the reported bug: must be able to tick.
  let d = await signedInAs('owner-1');
  assert.equal(d.myRole(), 'Admin', 'owner should resolve to Admin');
  assert.equal(d.canWorkOnTask('owner-1'), true, 'owner/assignee can change own task');
  assert.equal(d.canWorkOnTask('member-2'), true, "owner can change anyone's task");

  // Member: own task and unassigned yes, someone else's no.
  d = await signedInAs('member-1');
  assert.equal(d.canWorkOnTask('member-1'), true, 'assignee can change their task');
  assert.equal(d.canWorkOnTask(null), true, 'any member can change an unassigned task');
  assert.equal(d.canWorkOnTask('member-2'), false, "member can't change another member's task");

  // Viewer: never.
  d = await signedInAs('viewer-1');
  assert.equal(d.canWorkOnTask('viewer-1'), false, 'viewer is read-only');

  console.log('All member permission tests passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
