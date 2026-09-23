import type { CommentDto } from '../api/api.types';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Comment } from '../../shared/models/comment.models';
import type { Task } from '../../shared/models/task.models';
import { ToastService } from '../toast/toast.service';
import { MemberDirectoryService } from './member-directory.service';
import { TaskStoreService } from './task-store.service';
import { CommentApiService } from '../api/comment-api.service';
import { IndexedDbService } from '../pwa/indexed-db.service';
import { OfflineSyncService } from '../pwa/offline-sync.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';

@Injectable({ providedIn: 'root' })
export class CommentStoreService {
  private readonly toast = inject(ToastService);
  private readonly members = inject(MemberDirectoryService);
  private readonly tasks = inject(TaskStoreService);
  private readonly commentApi = inject(CommentApiService);
  private readonly idb = inject(IndexedDbService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly workspace = inject(WorkspaceContextService);

  readonly commentsByTaskId = signal<Record<string, Comment[]>>({});
  readonly commentDraft = signal('');
  readonly isLoading = signal(false);
  readonly isPosting = signal(false);
  private readonly deletingCommentIds = new Set<string>();

  private readonly selectedTaskId = computed(() => this.tasks.selectedTask()?.id);
  private readonly liveVersions = new Map<string, number>();

  constructor() {
    effect(() => {
      // Clear cached comments whenever switching project.
      this.workspace.activeProjectId();
      this.commentsByTaskId.set({});
      this.commentDraft.set('');
      this.isLoading.set(false);
      this.isPosting.set(false);
      this.deletingCommentIds.clear();
      this.liveVersions.clear();
    });

    effect(() => {
      const taskId = this.selectedTaskId();
      if (taskId) {
        this.loadComments(taskId);
      } else {
        this.isLoading.set(false);
        this.commentDraft.set('');
      }
    });
  }

  clear(): void {
    this.commentsByTaskId.set({});
    this.commentDraft.set('');
    this.isLoading.set(false);
    this.isPosting.set(false);
    this.deletingCommentIds.clear();
    this.liveVersions.clear();
  }

  loadComments(taskId: string): void {
    this.isLoading.set(true);
    const liveVersion = this.liveVersions.get(taskId) ?? 0;

    // 1. Immediately hydrate from IndexedDB cache
    void this.idb.getAllByIndex<Comment>('comments', 'taskId', taskId).then((cached) => {
      if (cached.length > 0 && !(this.commentsByTaskId()[taskId]?.length)) {
        this.commentsByTaskId.update((map) => ({
          ...map,
          [taskId]: cached,
        }));
        this.isLoading.set(false);
      }
    });

    this.commentApi.getComments(taskId).subscribe({
      next: (dtos) => {
        if (liveVersion !== (this.liveVersions.get(taskId) ?? 0)) { this.loadComments(taskId); return; }
        const mapped = (dtos || []).map((dto) => ({
          id: dto._id || (dto as any).id,
          taskId,
          authorId: dto.authorId,
          author: dto.author?.name || 'Unknown User',
          body: dto.body,
          createdAt: dto.createdAt,
        }));
        this.commentsByTaskId.update((map) => ({
          ...map,
          [taskId]: mapped,
        }));
        void this.idb.putMany('comments', mapped);
        this.isLoading.set(false);
      },
      error: () => {
        if (!(this.commentsByTaskId()[taskId]?.length)) {
          this.toast.show('Failed to load comments', 'info');
        }
        this.isLoading.set(false);
      },
    });
  }

  readonly selectedTaskComments = computed(() => {
    const task = this.tasks.selectedTask();
    if (!task) return [];
    return this.commentsByTaskId()[task.id] ?? [];
  });

  applyLiveComment(taskId: string, dto?: CommentDto, deletedId?: string): void {
    const id = dto?._id ?? deletedId; if (!id) return;
    this.liveVersions.set(taskId, (this.liveVersions.get(taskId) ?? 0) + 1);
    const comment: Comment | null = dto ? { id, authorId: dto.authorId, author: dto.author?.name ?? 'Unknown User', body: dto.body, createdAt: dto.createdAt } : null;
    this.commentsByTaskId.update(map => ({ ...map, [taskId]: comment ? [...(map[taskId] ?? []).filter(c => c.id !== id), comment].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : (map[taskId] ?? []).filter(c => c.id !== id) }));
    if (comment) void this.idb.put('comments', { ...comment, taskId, projectId: dto!.projectId }); else void this.idb.delete('comments', id);
  }

  postComment(task: Task): void {
    const body = this.commentDraft().trim();
    if (!body || this.isPosting()) return;

    if (!navigator.onLine) {
      const newComment: Comment = {
        id: `offline-c-${Date.now()}`,
        authorId: this.members.currentUser.id,
        author: this.members.currentUser.name || 'You',
        body,
        createdAt: new Date().toISOString(),
      };
      this.commentsByTaskId.update((map) => {
        const existing = map[task.id] ?? [];
        return {
          ...map,
          [task.id]: [...existing.filter(c => c.id !== newComment.id), newComment],
        };
      });
      this.tasks.incrementCommentCount(task.id);
      this.commentDraft.set('');
      void this.idb.put('comments', { ...newComment, taskId: task.id, projectId: task.projectId });
      void this.offlineSync.enqueue('ADD_COMMENT', `/tasks/${task.id}/comments`, 'POST', { body }, task.projectId);
      this.toast.show('Comment posted (saved offline)', 'info');
      return;
    }

    this.isPosting.set(true);
    this.commentApi.createComment(task.id, body).subscribe({
      next: ({ comment: dto }) => {
        this.isPosting.set(false);
        const newComment: Comment = {
          id: dto._id || (dto as any).id,
          authorId: dto.authorId,
          author: dto.author?.name || this.members.currentUser.name,
          body: dto.body,
          createdAt: dto.createdAt,
        };
        this.commentsByTaskId.update((map) => {
          const existing = map[task.id] ?? [];
          return {
            ...map,
            [task.id]: [...existing.filter(c => c.id !== newComment.id), newComment],
          };
        });
        this.tasks.incrementCommentCount(task.id);
        this.commentDraft.set('');
        void this.idb.put('comments', { ...newComment, taskId: task.id, projectId: task.projectId });
        this.toast.show('Comment posted', 'success');
      },
      error: (err) => {
        this.isPosting.set(false);
        if (err.status === 0 || !navigator.onLine) {
          const newComment: Comment = {
            id: `offline-c-${Date.now()}`,
            authorId: this.members.currentUser.id,
            author: this.members.currentUser.name || 'You',
            body,
            createdAt: new Date().toISOString(),
          };
          this.commentsByTaskId.update((map) => {
            const existing = map[task.id] ?? [];
            return {
              ...map,
              [task.id]: [...existing.filter(c => c.id !== newComment.id), newComment],
            };
          });
          this.tasks.incrementCommentCount(task.id);
          this.commentDraft.set('');
          void this.idb.put('comments', { ...newComment, taskId: task.id, projectId: task.projectId });
          void this.offlineSync.enqueue('ADD_COMMENT', `/tasks/${task.id}/comments`, 'POST', { body }, task.projectId);
          this.toast.show('Comment posted (saved offline)', 'info');
        } else {
          this.toast.show('Failed to post comment', 'info');
        }
      },
    });
  }

  deleteComment(taskId: string, commentId: string): void {
    if (this.deletingCommentIds.has(commentId)) return;
    this.deletingCommentIds.add(commentId);

    // Optimistic delete
    this.commentsByTaskId.update((map) => {
      const existing = map[taskId] ?? [];
      return {
        ...map,
        [taskId]: existing.filter((c) => c.id !== commentId),
      };
    });
    void this.idb.delete('comments', commentId);

    if (!navigator.onLine) {
      this.deletingCommentIds.delete(commentId);
      void this.offlineSync.enqueue('DELETE_COMMENT', `/comments/${commentId}`, 'DELETE');
      this.toast.show('Comment deleted (offline)', 'info');
      return;
    }

    this.commentApi.deleteComment(commentId).subscribe({
      next: () => {
        this.deletingCommentIds.delete(commentId);
        this.toast.show('Comment deleted', 'success');
      },
      error: (err) => {
        this.deletingCommentIds.delete(commentId);
        if (err.status === 0 || !navigator.onLine) {
          void this.offlineSync.enqueue('DELETE_COMMENT', `/comments/${commentId}`, 'DELETE');
          this.toast.show('Comment deleted (offline)', 'info');
        } else {
          this.toast.show('Failed to delete comment', 'info');
          this.loadComments(taskId); // reload on rollback
        }
      },
    });
  }
}
