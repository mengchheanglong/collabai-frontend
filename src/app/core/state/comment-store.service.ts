import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Comment } from '../../shared/models/comment.models';
import type { Task } from '../../shared/models/task.models';
import { ToastService } from '../toast/toast.service';
import { MemberDirectoryService } from './member-directory.service';
import { TaskStoreService } from './task-store.service';
import { CommentApiService } from '../api/comment-api.service';
import { IndexedDbService } from '../pwa/indexed-db.service';
import { OfflineSyncService } from '../pwa/offline-sync.service';

@Injectable({ providedIn: 'root' })
export class CommentStoreService {
  private readonly toast = inject(ToastService);
  private readonly members = inject(MemberDirectoryService);
  private readonly tasks = inject(TaskStoreService);
  private readonly commentApi = inject(CommentApiService);
  private readonly idb = inject(IndexedDbService);
  private readonly offlineSync = inject(OfflineSyncService);

  readonly commentsByTaskId = signal<Record<string, Comment[]>>({});
  readonly commentDraft = signal('');
  readonly isLoading = signal(false);

  constructor() {
    effect(() => {
      const task = this.tasks.selectedTask();
      if (task) {
        this.loadComments(task.id);
      } else {
        this.isLoading.set(false);
        this.commentDraft.set('');
      }
    });
  }

  loadComments(taskId: string): void {
    this.isLoading.set(true);

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

  postComment(task: Task): void {
    const body = this.commentDraft().trim();
    if (!body) return;

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
          [task.id]: [...existing, newComment],
        };
      });
      this.tasks.incrementCommentCount(task.id);
      this.commentDraft.set('');
      void this.idb.put('comments', { ...newComment, taskId: task.id, projectId: task.projectId });
      void this.offlineSync.enqueue('ADD_COMMENT', `/tasks/${task.id}/comments`, 'POST', { body }, task.projectId);
      this.toast.show('Comment posted (saved offline)', 'info');
      return;
    }

    this.commentApi.createComment(task.id, body).subscribe({
      next: ({ comment: dto }) => {
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
            [task.id]: [...existing, newComment],
          };
        });
        this.tasks.incrementCommentCount(task.id);
        this.commentDraft.set('');
        void this.idb.put('comments', { ...newComment, taskId: task.id, projectId: task.projectId });
        this.toast.show('Comment posted', 'success');
      },
      error: (err) => {
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
              [task.id]: [...existing, newComment],
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
      void this.offlineSync.enqueue('DELETE_COMMENT', `/comments/${commentId}`, 'DELETE');
      this.toast.show('Comment deleted (offline)', 'info');
      return;
    }

    this.commentApi.deleteComment(commentId).subscribe({
      next: () => {
        this.toast.show('Comment deleted', 'success');
      },
      error: (err) => {
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
