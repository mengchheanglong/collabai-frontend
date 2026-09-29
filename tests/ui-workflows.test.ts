import '@angular/compiler';
import assert from 'node:assert/strict';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { LoginComponent } from '../src/app/features/auth/login/login.component';
import { SignupComponent } from '../src/app/features/auth/signup/signup.component';
import { TaskDetailDrawerComponent } from '../src/app/features/board/task-detail-drawer.component';
import { TeamPageComponent } from '../src/app/features/team/team-page.component';
import { AuthStoreService } from '../src/app/core/state/auth-store.service';
import { TaskStoreService } from '../src/app/core/state/task-store.service';
import { MemberDirectoryService } from '../src/app/core/state/member-directory.service';
import { WorkspaceContextService } from '../src/app/core/workspace/workspace-context.service';
import { ToastService } from '../src/app/core/toast/toast.service';
import { CommentStoreService } from '../src/app/core/state/comment-store.service';
import { LiveCollaborationService } from '../src/app/core/realtime/live-collaboration.service';
import { BoardPageComponent } from '../src/app/features/board/board-page.component';
import { DocsPageComponent } from '../src/app/features/docs/docs-page.component';
import { DocsApiService } from '../src/app/core/api/docs-api.service';
import { ProjectApiService } from '../src/app/core/api/project-api.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { DOCUMENT } from '@angular/common';

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

async function testLoginWorkflow(): Promise<void> {
  let loggedInEmail = '';
  let loggedInPassword = '';

  const mockAuthStore = {
    isLoading: signal(false),
    authError: signal<string | null>(null),
    clearAuthError: () => {},
    login: (email: string, pass: string) => {
      loggedInEmail = email;
      loggedInPassword = pass;
    },
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      FormBuilder,
      { provide: Router, useValue: { navigate: async () => true } },
      { provide: AuthStoreService, useValue: mockAuthStore },
    ],
  });

  const comp = TestBed.runInInjectionContext(() => new LoginComponent());

  // 1. Initial State: empty form is invalid
  assert.equal(comp.form.valid, false);
  assert.equal(comp.showPassword(), false);

  // 2. Toggle password visibility
  comp.togglePasswordVisibility();
  assert.equal(comp.showPassword(), true);
  comp.togglePasswordVisibility();
  assert.equal(comp.showPassword(), false);

  // 3. Submitting invalid form blocks login
  comp.submit();
  assert.equal(loggedInEmail, '');
  assert.equal(comp.isInvalid('email'), true);
  assert.equal(comp.isInvalid('password'), true);

  // 4. Entering valid credentials
  comp.form.controls.email.setValue('developer@example.com');
  comp.form.controls.password.setValue('SuperSecret123!');
  assert.equal(comp.form.valid, true);

  // 5. Submit calls authStore.login
  comp.submit();
  assert.equal(loggedInEmail, 'developer@example.com');
  assert.equal(loggedInPassword, 'SuperSecret123!');

  console.log('✓ Login component UI workflow passed.');
}

async function testSignupWorkflow(): Promise<void> {
  let registeredPayload: any = null;

  const mockAuthStore = {
    isLoading: signal(false),
    authError: signal<string | null>(null),
    clearAuthError: () => {},
    register: (fn: string, ln: string, email: string, pass: string) => {
      registeredPayload = { fn, ln, email, pass };
    },
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      FormBuilder,
      { provide: AuthStoreService, useValue: mockAuthStore },
    ],
  });

  const comp = TestBed.runInInjectionContext(() => new SignupComponent());

  // 1. Password strength meter tests
  comp.form.controls.password.setValue('short');
  assert.equal(comp.passwordStrength().score <= 2, true);

  comp.form.controls.password.setValue('SuperSecurePassword2026!');
  const strength = comp.passwordStrength();
  assert.equal(strength.hasLen, true);
  assert.equal(strength.hasCase, true);
  assert.equal(strength.hasNum, true);
  assert.equal(strength.hasSpecial, true);
  assert.equal(strength.score, 4);
  assert.equal(strength.label, 'Strong');

  // 2. Reject missing uppercase/number
  comp.form.controls.password.setValue('alllowercasepassword');
  assert.equal(comp.form.controls.password.valid, false);

  // 3. Valid user signup
  comp.form.controls.firstName.setValue('Alice');
  comp.form.controls.lastName.setValue('Smith');
  comp.form.controls.email.setValue('alice@example.com');
  comp.form.controls.password.setValue('ValidPassword123');
  assert.equal(comp.form.valid, true);

  comp.submit();
  assert.deepEqual(registeredPayload, {
    fn: 'Alice',
    ln: 'Smith',
    email: 'alice@example.com',
    pass: 'ValidPassword123',
  });

  console.log('✓ Signup component UI workflow passed.');
}

async function testTaskDetailDrawerWorkflow(): Promise<void> {
  let updatedTaskData: Partial<Task> | null = null;
  let addedSubtaskTitle: string | null = null;
  let closed = false;

  const mockTask: Task = {
    id: 'task-100',
    projectId: 'proj-1',
    boardId: 'board-1',
    title: 'Original Title',
    description: 'Original Description',
    status: 'todo',
    priority: 'medium',
    position: 1000,
    createdById: 'user-1',
    assigneeId: 'user-1',
    dueDate: '2026-10-15T00:00:00.000Z',
    labels: ['bug', 'frontend'],
    comments: 2,
    subtasks: [
      { id: 'sub-1', title: 'First subtask', done: false },
      { id: 'sub-2', title: 'Second subtask', done: true },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  const mockTasks = {
    selectedTask: signal<Task | null>(mockTask),
    statusLabel: (s: TaskStatus) => s.toUpperCase(),
    updateTask: (id: string, fields: Partial<Task>) => {
      updatedTaskData = fields;
    },
    addManualSubtask: (taskId: string, title: string) => {
      addedSubtaskTitle = title;
    },
    closeTask: () => {
      closed = true;
    },
  };

  const mockMembers = {
    members: signal<Member[]>([
      { id: 'user-1', name: 'Alice Smith', email: 'alice@example.com', role: 'Admin', avatarUrl: null },
      { id: 'user-2', name: 'Bob Jones', email: 'bob@example.com', role: 'Member', avatarUrl: null },
    ]),
    memberName: (id: string) => (id === 'user-1' ? 'Alice Smith' : 'Bob Jones'),
  };

  const mockWorkspace = {
    filteredProjects: signal([{ id: 'proj-1', name: 'CollabAI Core' }]),
    activeProjectName: signal('CollabAI Core'),
  };

  const mockToast = {
    success: () => {},
    info: () => {},
    error: () => {},
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: DOCUMENT, useValue: (globalThis as any).document },
      { provide: TaskStoreService, useValue: mockTasks },
      { provide: MemberDirectoryService, useValue: mockMembers },
      { provide: WorkspaceContextService, useValue: mockWorkspace },
      { provide: ToastService, useValue: mockToast },
      { provide: CommentStoreService, useValue: { commentsForTask: () => [] } },
      { provide: LiveCollaborationService, useValue: { typingUsers: signal({}) } },
    ],
  });

  const comp = TestBed.runInInjectionContext(() => new TaskDetailDrawerComponent());

  // 1. Project name & Assignee label derivation
  assert.equal(comp.projectName(mockTask), 'CollabAI Core');
  assert.equal(comp.assigneeLabel(mockTask), 'Alice Smith');

  // 2. Title editing: empty title reverts
  const mockInput = { value: '   ' } as HTMLInputElement;
  comp.saveTitle(mockTask, mockInput);
  assert.equal(mockInput.value, 'Original Title');
  assert.equal(updatedTaskData, null);

  // Title editing: non-empty updates
  mockInput.value = 'Refactored Title';
  comp.saveTitle(mockTask, mockInput);
  assert.deepEqual(updatedTaskData, { title: 'Refactored Title' });

  // 3. Description editing
  comp.saveDescription(mockTask, 'Updated task description content');
  assert.deepEqual(updatedTaskData, { description: 'Updated task description content' });

  // 4. Status updates
  comp.updateStatus(mockTask, 'in_progress');
  assert.deepEqual(updatedTaskData, { status: 'in_progress' });

  // 5. Priority updates
  comp.updatePriority(mockTask, 'urgent');
  assert.deepEqual(updatedTaskData, { priority: 'urgent' });

  // 6. Subtask addition
  const subtaskInput = { value: 'New Test Subtask' } as HTMLInputElement;
  comp.handleAddSubtask(mockTask, subtaskInput);
  assert.equal(addedSubtaskTitle, 'New Test Subtask');
  assert.equal(subtaskInput.value, '');

  // 7. Escape key closes task
  comp.onEscape();
  assert.equal(closed, true);

  console.log('✓ Task detail drawer UI workflow passed.');
}

async function testTeamPageWorkflow(): Promise<void> {
  const membersList: Member[] = [
    { id: 'user-1', name: 'Alice Smith', email: 'alice@example.com', role: 'Admin', avatarUrl: null },
    { id: 'user-2', name: 'Bob Builder', email: 'bob@example.com', role: 'Member', avatarUrl: null },
    { id: 'user-3', name: 'Charlie Viewer', email: 'charlie@example.com', role: 'Viewer', avatarUrl: null },
  ];

  let invitedEmail = '';
  let invitedRole = '';
  let roleUpdated = '';

  const mockMembers = {
    members: signal<Member[]>(membersList),
    memberCount: signal(3),
    adminCount: signal(1),
    activeCount: signal(3),
    currentUser: { id: 'user-1', name: 'Alice Smith' },
    inviteMember: (email: string, role: string) => {
      invitedEmail = email;
      invitedRole = role;
      return { id: 'new-user', name: email.split('@')[0], email, role: role as any, avatarUrl: null };
    },
    updateRole: (id: string, role: Member['role']) => {
      roleUpdated = `${id}:${role}`;
      return { ok: true };
    },
    resendInvitation: () => {},
    revokeInvitation: () => {},
  };

  let toastError: string | undefined;
  const mockToast = {
    success: () => {},
    info: () => {},
    error: (msg: string) => {
      toastError = msg;
    },
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: DOCUMENT, useValue: (globalThis as any).document },
      { provide: MemberDirectoryService, useValue: mockMembers },
      { provide: WorkspaceContextService, useValue: {} },
      { provide: ToastService, useValue: mockToast },
    ],
  });

  const comp = TestBed.runInInjectionContext(() => new TeamPageComponent());

  // 1. Initial listing & count derivations
  assert.equal(comp.filteredMembers().length, 3);
  assert.equal(comp.nonAdminCount(), 2);
  assert.equal(comp.activeRate(), 100);

  // 2. Role filtering
  comp.setRoleFilter('Member');
  assert.equal(comp.filteredMembers().length, 1);
  assert.equal(comp.filteredMembers()[0].name, 'Bob Builder');

  comp.setRoleFilter('all');
  assert.equal(comp.filteredMembers().length, 3);

  // 3. Search query filtering
  comp.searchQuery.set('Charlie');
  assert.equal(comp.filteredMembers().length, 1);
  assert.equal(comp.filteredMembers()[0].email, 'charlie@example.com');
  comp.clearFilters();
  assert.equal(comp.filteredMembers().length, 3);

  // 4. Invite workflow
  comp.openInvite();
  assert.equal(comp.inviteOpen(), true);

  comp.inviteEmail.set('newteammate@example.com');
  comp.inviteRole.set('Member');
  comp.sendInvite();
  assert.equal(invitedEmail, 'newteammate@example.com');
  assert.equal(invitedRole, 'Member');
  assert.equal(comp.inviteOpen(), false);

  // 5. Role change workflow
  comp.onRoleChange(membersList[1], 'Admin');
  assert.equal(roleUpdated, 'user-2:Admin');

  // 6. Self-removal protection
  const clickEvent = { stopPropagation: () => {} } as any;
  comp.openRemoveDialog(clickEvent, membersList[0]); // user-1 is currentUser
  assert.ok(toastError?.includes('cannot remove your own active account'));
  assert.equal(comp.removeTarget(), null);

  // Removing another user opens dialog
  comp.openRemoveDialog(clickEvent, membersList[1]); // user-2
  assert.equal(comp.removeTarget()?.id, 'user-2');

  console.log('✓ Team page component UI workflow passed.');
}

async function testBoardWorkflow(): Promise<void> {
  let createdTaskParams: any = null;
  const mockTasks = {
    searchQuery: signal(''),
    clearSmartSearch: () => {},
    createTaskFromAi: (title: string, desc: string, projId: string, boardId: string, opts: any) => {
      createdTaskParams = { title, desc, projId, boardId, opts };
      return of({ id: 'task-new', title });
    },
  };
  const mockWorkspace = {
    activeProjectId: signal('proj-1'),
    activeBoardId: signal('board-1'),
  };
  let toastMsg = '';
  const mockToast = {
    show: (msg: string) => {
      toastMsg = msg;
    },
    success: (msg: string) => {
      toastMsg = msg;
    },
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: DOCUMENT, useValue: (globalThis as any).document },
      { provide: TaskStoreService, useValue: mockTasks },
      { provide: WorkspaceContextService, useValue: mockWorkspace },
      { provide: MemberDirectoryService, useValue: { members: signal([]) } },
      { provide: ToastService, useValue: mockToast },
    ],
  });

  const comp = TestBed.runInInjectionContext(() => new BoardPageComponent());

  // 1. Create Modal toggle
  assert.equal(comp.showCreateModal(), false);
  comp.openCreateModal();
  assert.equal(comp.showCreateModal(), true);
  comp.closeCreateModal();
  assert.equal(comp.showCreateModal(), false);

  // 2. Reject empty title
  comp.openCreateModal();
  comp.newTitle.set('   ');
  comp.submitCreateTask();
  assert.equal(createdTaskParams, null);
  assert.ok(toastMsg.includes('Please enter a task title'));

  // 3. Valid task creation
  comp.newTitle.set('Implement WebSocket Reconnect');
  comp.newDescription.set('Auto retry with backoff');
  comp.newPriority.set('high');
  comp.newStatus.set('in_progress');
  comp.submitCreateTask();

  assert.equal(createdTaskParams.title, 'Implement WebSocket Reconnect');
  assert.equal(createdTaskParams.desc, 'Auto retry with backoff');
  assert.equal(createdTaskParams.opts.priority, 'high');
  assert.equal(createdTaskParams.opts.status, 'in_progress');
  assert.equal(comp.showCreateModal(), false);

  // 4. Filter search input
  comp.onFilterInput('websocket');
  assert.equal(mockTasks.searchQuery(), 'websocket');
  comp.clearAiFilter();
  assert.equal(mockTasks.searchQuery(), '');

  console.log('✓ Board page component UI workflow passed.');
}

async function testDocsWorkflow(): Promise<void> {
  let updatedDocPayload: any = null;
  const mockDocApi = {
    get: () =>
      of({
        document: {
          _id: 'doc-1',
          projectId: 'proj-1',
          title: 'Architecture Spec',
          content: '# System Design',
          version: 123456,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
        canEdit: true,
      }),
    update: (id: string, body: any) => {
      updatedDocPayload = { id, body };
      return of({
        document: {
          _id: id,
          projectId: 'proj-1',
          title: body.title,
          content: body.content,
          version: body.version + 1,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:05:00.000Z',
        },
      });
    },
    list: () => of({ data: [], meta: { totalPages: 1 } }),
  };

  const mockActivatedRoute = {
    paramMap: of(new Map([['documentId', 'doc-1']])),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: DOCUMENT, useValue: (globalThis as any).document },
      { provide: DocsApiService, useValue: mockDocApi },
      { provide: ProjectApiService, useValue: { get: () => of({ members: [] }) } },
      { provide: AuthStoreService, useValue: { currentUser: signal({ _id: 'user-1' }) } },
      { provide: WorkspaceContextService, useValue: { activeProjectId: signal('proj-1') } },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: Router, useValue: { navigate: async () => true } },
    ],
  });

  const comp = TestBed.runInInjectionContext(() => new DocsPageComponent());
  await comp.load('doc-1', 'proj-1');

  // 1. Initial loaded state
  assert.equal(comp.title(), 'Architecture Spec');
  assert.equal(comp.content(), '# System Design');
  assert.equal(comp.canEdit(), true);
  assert.equal(comp.dirty(), false);

  // 2. Modifying content triggers dirty state
  comp.content.set('# System Design\n\nAdded concurrency rules.');
  assert.equal(comp.dirty(), true);

  // 3. Preview toggle
  assert.equal(comp.preview(), false);
  comp.preview.set(true);
  assert.equal(comp.preview(), true);
  assert.ok(comp.html().includes('System Design'));

  // 4. Save propagates optimistic version
  await comp.save();
  assert.equal(updatedDocPayload.id, 'doc-1');
  assert.equal(updatedDocPayload.body.version, 123456);
  assert.equal(updatedDocPayload.body.title, 'Architecture Spec');
  assert.equal(comp.dirty(), false);

  // 5. File format badges and helper checks
  assert.equal(comp.getFileBadge('manual.pdf', 'application/pdf').label, 'PDF');
  assert.equal(comp.getFileBadge('spec.docx').label, 'DOCX');
  assert.equal(comp.getFileBadge('notes.doc').label, 'DOC');
  assert.equal(comp.getFileBadge('readme.md').label, 'MD');
  assert.equal(comp.getFileBadge('data.txt').label, 'TXT');
  assert.equal(comp.cleanTitleFromFilename('Product_Roadmap_2026.pdf'), 'Product Roadmap 2026');
  assert.equal(comp.formatBytes(1024), '1 KB');
  assert.equal(comp.formatBytes(2097152), '2 MB');

  // 6. Attachment management workflow
  comp.attachments.set([
    {
      id: 'att-1',
      name: 'Architecture.pdf',
      size: 1048576,
      type: 'application/pdf',
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjc=',
      uploadedAt: '2026-09-01T00:00:00.000Z',
    },
  ]);
  assert.equal(comp.attachments().length, 1);
  assert.equal(comp.dirty(), true);

  comp.togglePdfPreview(comp.attachments()[0]);
  assert.equal(comp.activePreviewAttachment()?.id, 'att-1');
  assert.ok(comp.safePdfUrl() !== null);

  comp.togglePdfPreview(comp.attachments()[0]);
  assert.equal(comp.activePreviewAttachment(), null);

  comp.removeAttachment(0);
  assert.equal(comp.attachments().length, 0);

  console.log('✓ Docs page component UI workflow passed.');
}

async function main(): Promise<void> {
  if (!getTestBed().platform) {
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  }

  await testLoginWorkflow();
  await testSignupWorkflow();
  await testTaskDetailDrawerWorkflow();
  await testTeamPageWorkflow();
  await testBoardWorkflow();
  await testDocsWorkflow();

  console.log('\nAll comprehensive frontend UI workflow tests passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
