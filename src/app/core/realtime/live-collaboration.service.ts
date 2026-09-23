import { Injectable, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { SocketService, LiveEvent } from './socket.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import { TaskStoreService } from '../state/task-store.service';
import { CommentStoreService } from '../state/comment-store.service';
import { MemberDirectoryService } from '../state/member-directory.service';
import { NotificationStoreService } from '../state/notification-store.service';
import { ActivityStoreService } from '../state/activity-store.service';
import { OfflineSyncService } from '../pwa/offline-sync.service';
import { AuthStoreService } from '../state/auth-store.service';
import type { TaskDto, CommentDto, NotificationDto } from '../api/api.types';
import type { ActivityDto } from '../api/activity-api.service';
@Injectable()
export class LiveCollaborationService implements OnDestroy {
 readonly socket = inject(SocketService);
 private readonly workspace = inject(WorkspaceContextService);
 private readonly tasks = inject(TaskStoreService);
 private readonly comments = inject(CommentStoreService);
 private readonly members = inject(MemberDirectoryService);
 private readonly notifications = inject(NotificationStoreService);
 private readonly activities = inject(ActivityStoreService);
 private readonly offline = inject(OfflineSyncService);
 private readonly auth = inject(AuthStoreService);
 private readonly subscriptions = new Subscription();
 private deferred = false;
 private refreshVersion = 0;
 readonly typingUsers = signal<Record<string, { taskId: string; name: string }>>({});
 private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
 private stopTimer?: ReturnType<typeof setTimeout>;
 private typingTask: string | null = null;
 constructor() {
  effect(() => { const projectId = this.workspace.activeProjectId(); untracked(() => { this.clearTyping(); this.socket.setProject(projectId); }); });
  effect(() => { const taskId = this.tasks.selectedTask()?.id; untracked(() => { if (this.typingTask && this.typingTask !== taskId) this.stopTyping(); }); });
  effect(() => { const pending = this.offline.pendingCount(); const syncing = this.offline.isSyncing(); if (!pending && !syncing && this.deferred) untracked(() => { this.deferred = false; void this.refresh(); }); });
  this.subscriptions.add(this.socket.joined$.subscribe(() => void this.refresh()));
  this.subscriptions.add(this.socket.denied$.subscribe(id => { if (id === this.workspace.activeProjectId()) this.loseProject(id); }));
  this.subscriptions.add(this.socket.events$.subscribe(({ name, event }) => this.apply(name, event)));
 }
 ngOnDestroy() { this.refreshVersion++; this.subscriptions.unsubscribe(); this.stopTyping(); this.clearTyping(); this.socket.setProject(null); }
 private async refresh() {
  const projectId = this.workspace.activeProjectId(); const version = ++this.refreshVersion;
  if (!projectId) return;
  if (this.offline.pendingCount()) await this.offline.flushOutboxAndSync(projectId);
  if (this.workspace.activeProjectId() !== projectId || version !== this.refreshVersion) return;
  if (this.offline.pendingCount() || this.offline.isSyncing()) { this.deferred = true; return; }
  this.workspace.reloadBoards(projectId);
  const board = this.workspace.activeBoardId(); if (board) this.tasks.loadBoard(board);
  const task = this.tasks.selectedTask(); if (task) this.comments.loadComments(task.id);
  this.members.refreshMembers(); this.notifications.loadNotifications(); this.activities.loadForProject(projectId);
 }
 private loseProject(projectId: string) {
  this.workspace.removeLiveProject(projectId); this.tasks.clearUiState(); this.comments.commentsByTaskId.set({}); this.clearTyping(); this.workspace.reloadProjects();
 }
 private apply(name: string, event: LiveEvent) {
  const data = event.data;
  if (name === 'notification:created') { this.notifications.applyLive(data['notification'] as NotificationDto); return; }
  if (name === 'member:added' && data['userId'] === this.auth.currentUser()?._id) this.workspace.reloadProjects();
  if (event.projectId !== this.workspace.activeProjectId()) return;
  if (name === 'project:deleted' || (name === 'member:removed' && data['userId'] === this.auth.currentUser()?._id)) { this.loseProject(event.projectId); return; }
  if (name === 'typing:started' || name === 'typing:stopped') { this.applyTyping(name, event); return; }
  if (this.offline.pendingCount() || this.offline.isSyncing()) { this.deferred = true; return; }
  if (name.startsWith('task:')) {
   if (name === 'task:deleted') this.tasks.applyLiveTask(null, String(data['taskId']));
   else if (data['task']) this.tasks.applyLiveTask(data['task'] as TaskDto);
  } else if (name.startsWith('comment:')) this.comments.applyLiveComment(String(data['taskId']), data['comment'] as CommentDto | undefined, data['commentId'] as string | undefined);
  else if (name.startsWith('board:')) this.workspace.reloadBoards(event.projectId);
  else if (name === 'project:updated') this.workspace.reloadProjects(event.projectId);
  else if (name.startsWith('member:')) { this.members.refreshMembers(); this.workspace.reloadProjects(event.projectId); }
  else if (name === 'activity:created') this.activities.applyLive(data['activity'] as ActivityDto);
 }
 typing(taskId: string) {
  if (this.typingTask && this.typingTask !== taskId) this.stopTyping();
  this.typingTask = taskId; this.socket.typing(taskId, true);
  clearTimeout(this.stopTimer); this.stopTimer = setTimeout(() => this.stopTyping(), 1500);
 }
 stopTyping() { clearTimeout(this.stopTimer); if (this.typingTask) this.socket.typing(this.typingTask, false); this.typingTask = null; }
 typingLabel(taskId: string) { const names = Object.values(this.typingUsers()).filter(user => user.taskId === taskId).map(user => user.name); return names.length ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} typing…` : ''; }
 private applyTyping(name: string, event: LiveEvent) {
  if (event.actorId === this.auth.currentUser()?._id) return;
  const key = `${event.actorId}:${String(event.data['taskId'])}`;
  clearTimeout(this.typingTimers.get(key));
  const remove = () => { this.typingUsers.update(users => { const next = { ...users }; delete next[key]; return next; }); this.typingTimers.delete(key); };
  if (name === 'typing:stopped') remove();
  else { this.typingUsers.update(users => ({ ...users, [key]: { taskId: String(event.data['taskId']), name: String(event.data['name'] ?? 'A teammate') } })); this.typingTimers.set(key, setTimeout(remove, 4000)); }
 }
 private clearTyping() { for (const timer of this.typingTimers.values()) clearTimeout(timer); this.typingTimers.clear(); this.typingUsers.set({}); }
}
