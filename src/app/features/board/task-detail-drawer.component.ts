import { Component, HostListener, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommentStoreService } from '../../core/state/comment-store.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';

@Component({
  selector: 'app-task-detail-drawer',
  standalone: true,
  imports: [MatProgressBarModule],
  templateUrl: './task-detail-drawer.component.html',
})
export class TaskDetailDrawerComponent {
  readonly tasks = inject(TaskStoreService);
  readonly comments = inject(CommentStoreService);
  readonly members = inject(MemberDirectoryService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.tasks.selectedTask()) {
      this.tasks.closeTask();
    }
  }
}
