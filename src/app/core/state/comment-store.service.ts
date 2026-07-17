import { Injectable, computed, inject, signal } from '@angular/core';
import { taskComments as seedComments } from '../../data/mock/mock-comments';
import type { CommentPreview } from '../../shared/models/comment.models';
import type { Task } from '../../shared/models/task.models';
import { ToastService } from '../toast/toast.service';
import { MemberDirectoryService } from './member-directory.service';
import { TaskStoreService } from './task-store.service';

@Injectable({ providedIn: 'root' })
export class CommentStoreService {
  private readonly toast = inject(ToastService);
  private readonly members = inject(MemberDirectoryService);
  private readonly tasks = inject(TaskStoreService);

  readonly commentsByTaskId = signal<Record<string, CommentPreview[]>>(
    structuredClone(seedComments),
  );
  readonly commentDraft = signal('');

  readonly selectedTaskComments = computed(() => {
    const task = this.tasks.selectedTask();
    if (!task) return [];
    return this.commentsByTaskId()[task.id] ?? [];
  });

  postComment(task: Task): void {
    const body = this.commentDraft().trim();
    if (!body) return;

    this.commentsByTaskId.update((map) => {
      const existing = map[task.id] ?? [];
      return {
        ...map,
        [task.id]: [
          { author: this.members.currentUser.name, body, time: 'just now' },
          ...existing,
        ],
      };
    });

    this.tasks.incrementCommentCount(task.id);
    this.commentDraft.set('');
    this.toast.show('Comment posted', 'success');
  }
}
