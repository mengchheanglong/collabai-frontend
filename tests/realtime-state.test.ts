import '@angular/compiler';
import assert from 'node:assert/strict';
import { DOCUMENT } from '@angular/common';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { of, Subject } from 'rxjs';
import { TaskStoreService } from '../src/app/core/state/task-store.service';
import { CommentStoreService } from '../src/app/core/state/comment-store.service';
import { MemberDirectoryService } from '../src/app/core/state/member-directory.service';
import { WorkspaceContextService } from '../src/app/core/workspace/workspace-context.service';
import { BoardApiService } from '../src/app/core/api/board-api.service';
import { TaskApiService } from '../src/app/core/api/task-api.service';
import { CommentApiService } from '../src/app/core/api/comment-api.service';
import { AiService } from '../src/app/core/api/ai.service';
import { ToastService } from '../src/app/core/toast/toast.service';
import { IndexedDbService } from '../src/app/core/pwa/indexed-db.service';
import { OfflineSyncService } from '../src/app/core/pwa/offline-sync.service';
import { SocketService } from '../src/app/core/realtime/socket.service';
import { LiveCollaborationService } from '../src/app/core/realtime/live-collaboration.service';
import { NotificationStoreService } from '../src/app/core/state/notification-store.service';
import { ActivityStoreService } from '../src/app/core/state/activity-store.service';
import { AuthStoreService } from '../src/app/core/state/auth-store.service';

async function main(): Promise<void> {
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
const boards: Subject<any>[] = [];
const workspace = { activeProjectId: signal('project'), activeBoardId: signal('board'), reloadBoards: () => {}, reloadProjects: () => {}, removeLiveProject: () => {} };
const socket = { events$: new Subject<any>(), joined$: new Subject<string>(), denied$: new Subject<string>(), setProject: () => {}, typing: () => {} };
const pendingCount = signal(0); const isSyncing = signal(false);
let notificationLoads = 0;
TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(),
 { provide: DOCUMENT, useValue: {} }, TaskStoreService, CommentStoreService, LiveCollaborationService,
 { provide: WorkspaceContextService, useValue: workspace },
 { provide: BoardApiService, useValue: { getBoardWithTasks: () => { const response = new Subject<any>(); boards.push(response); return response; } } },
 { provide: TaskApiService, useValue: {} }, { provide: AiService, useValue: {} },
 { provide: CommentApiService, useValue: { getComments: () => of([]), createComment: () => of({ comment: commentDto }) } },
 { provide: MemberDirectoryService, useValue: { currentUser: { id: 'user', name: 'User' }, refreshMembers: () => {} } },
 { provide: ToastService, useValue: { show: () => {} } },
 { provide: IndexedDbService, useValue: { getAllByIndex: async () => [], put: async () => {}, putMany: async () => {}, delete: async () => {} } },
 { provide: OfflineSyncService, useValue: { syncCompleted$: new Subject(), pendingCount, isSyncing, flushOutboxAndSync: async () => {} } },
 { provide: SocketService, useValue: socket },
 { provide: NotificationStoreService, useValue: { loadNotifications: () => notificationLoads++, applyLive: () => {} } },
 { provide: ActivityStoreService, useValue: { loadForProject: () => {}, applyLive: () => {} } },
 { provide: AuthStoreService, useValue: { currentUser: signal({ _id: 'user' }) } },
] });
const dto = { _id: 'task', boardId: 'board', projectId: 'project', title: 'Original', description: '', status: 'todo' as const, priority: 'medium' as const, position: 1, createdById: 'user', labels: [], subtasks: [], createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z' };
const commentDto = { _id: 'comment', taskId: 'task', projectId: 'project', authorId: 'user', author: { _id: 'user', name: 'User', email: '' }, body: 'Comment', createdAt: dto.createdAt, updatedAt: dto.createdAt };
const tasks = TestBed.inject(TaskStoreService);
const comments = TestBed.inject(CommentStoreService);
const live = TestBed.inject(LiveCollaborationService);
TestBed.tick();
boards.at(-1)!.next({ tasks: [dto] });
tasks.selectedTask.set(tasks.tasks()[0]);
TestBed.tick();
// Same-account events must apply; duplicate payloads must not create duplicate cards.
const moved = { ...dto, status: 'done' as const, position: 2000, updatedAt: '2026-09-23T00:01:00.000Z' };
const event = { projectId: 'project', actorId: 'user', data: { task: moved }, createdAt: moved.updatedAt };
socket.events$.next({ name: 'task:moved', event }); socket.events$.next({ name: 'task:moved', event });
assert.equal(tasks.tasks().length, 1); assert.equal(tasks.tasks()[0].status, 'done'); assert.equal(tasks.selectedTask()?.position, 2000);
// An older REST response must not resurrect a card deleted during its request.
tasks.loadBoard('board'); socket.events$.next({ name: 'task:deleted', event: { ...event, data: { taskId: 'task' } } });
boards.at(-1)!.next({ tasks: [dto] }); assert.equal(tasks.tasks().length, 0); assert.equal(tasks.selectedTask(), null);
// Ignore payloads for inactive projects.
socket.events$.next({ name: 'task:created', event: { ...event, projectId: 'other' } }); assert.equal(tasks.tasks().length, 0);
// Offline mutations retain precedence until sync drains; the drain triggers refetch.
pendingCount.set(1); TestBed.tick(); socket.events$.next({ name: 'task:created', event }); assert.equal(tasks.tasks().length, 0);
pendingCount.set(0); TestBed.tick(); await Promise.resolve(); assert.ok(notificationLoads >= 1);
// Each successful room rejoin refetches the board rather than trusting missed packets.
const beforeReconnect = boards.length; socket.joined$.next('project'); await Promise.resolve(); assert.ok(boards.length > beforeReconnect);
// Repeated comment delivery and a later REST create reply deduplicate by persisted ID.
comments.applyLiveComment('task', commentDto); comments.applyLiveComment('task', commentDto);
assert.equal(comments.commentsByTaskId()['task'].length, 1);
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
comments.commentDraft.set('Comment'); comments.postComment({ ...tasks.tasks()[0], id: 'task', projectId: 'project' } as any);
assert.equal(comments.commentsByTaskId()['task'].length, 1);
comments.applyLiveComment('task', undefined, 'comment'); assert.equal(comments.commentsByTaskId()['task'].length, 0);
live.ngOnDestroy(); TestBed.resetTestingModule();
console.log('Realtime state checks passed: same-user merge, deduplication, in-flight deletion, project isolation, offline precedence, reconnect refetch, and comments.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
