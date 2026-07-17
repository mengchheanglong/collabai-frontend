import { Component, inject } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { TaskCardComponent } from './task-card.component';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [DragDropModule, TaskCardComponent],
  templateUrl: './kanban-board.component.html',
})
export class KanbanBoardComponent {
  readonly tasks = inject(TaskStoreService);
  readonly members = inject(MemberDirectoryService);

  readonly memberColor = (name: string) => this.members.memberColor(name);
  readonly initials = (name: string) => this.members.initials(name);
}
