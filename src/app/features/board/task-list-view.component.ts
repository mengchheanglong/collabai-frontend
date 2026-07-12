import { Component, inject } from '@angular/core';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';

@Component({
  selector: 'app-task-list-view',
  standalone: true,
  templateUrl: './task-list-view.component.html',
})
export class TaskListViewComponent {
  readonly tasks = inject(TaskStoreService);
  readonly members = inject(MemberDirectoryService);
}
