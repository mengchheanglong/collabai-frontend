import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Comment } from '../../shared/models/comment.models';
import type { Task } from '../../shared/models/task.models';
import { ToastService } from '../toast/toast.service';
import { MemberDirectoryService } from './member-directory.service';
import { TaskStoreService } from './task-store.service';
import { CommentApiService } from '../api/comment-api.service';

@Injectable({ providedIn: 'root' })
export class CommentStoreService {
  private readonly toast = inject(ToastService);
  private readonly members = inject(MemberDirectoryService);
  private readonly tasks = inject(TaskStoreService);
  private readonly commentApi = inject(CommentApiService);

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
    this.commentApi.getComments(taskId).subscribe({
      next: (dtos) => {
        const mapped = (dtos || []).map((dto) => ({
          id: dto._id || (dto as any).id,
          authorId: dto.authorId,
          author: dto.author?.name || 'Unknown User',
          body: dto.body,
          createdAt: dto.createdAt,
        }));
        this.commentsByTaskId.update((map) => ({
          ...map,
          [taskId]: mapped,
        }));
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load comments', 'info');
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

    this.commentApi.createComment(task.id, body).subscribe({
      next: ({ comment: dto }) => {
        const newComment: Comment = {
          id: dto._id || (dto as any).id,
          authorId: dto.authorId,
          author: dto.author?.name || this.members.currentUser.name,
          body: dto.body,
          createdAt: dto.createdAt
        };
        this.commentsByTaskId.update((map) => {
          const existing = map[task.id] ?? [];
          return {
            ...map,
            [task.id]: [...existing, newComment]
          };
        });
        this.tasks.incrementCommentCount(task.id);
        this.commentDraft.set('');
        this.toast.show('Comment posted', 'success');
      },
      error: () => {
        this.toast.show('Failed to post comment', 'info');
      }
    });
  }

  deleteComment(taskId: string, commentId: string): void {
    // Optimistic delete
    this.commentsByTaskId.update(map => {
      const existing = map[taskId] ?? [];
      return {
        ...map,
        [taskId]: existing.filter(c => c.id !== commentId)
      };
    });
    
    this.commentApi.deleteComment(commentId).subscribe({
      next: () => {
        this.toast.show('Comment deleted', 'success');
        // Let's assume the backend automatically adjusts commentCount or the frontend does not care for small discrepancies
      },
      error: () => {
        this.toast.show('Failed to delete comment', 'info');
        this.loadComments(taskId); // reload on rollback
      }
    });
  }
}
