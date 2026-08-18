import { Component, inject } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TaskStoreService } from '../../core/state/task-store.service';
import { TaskCardComponent } from './task-card.component';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [DragDropModule, TaskCardComponent],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
})
export class KanbanBoardComponent {
  readonly tasks = inject(TaskStoreService);
}
