import { Component, inject } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { TaskStoreService } from '../../core/state/task-store.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import type { BoardView } from '../../shared/models/navigation.models';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { KanbanBoardComponent } from './kanban-board.component';
import { TaskDetailDrawerComponent } from './task-detail-drawer.component';
import { TaskListViewComponent } from './task-list-view.component';

@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [
    MatRippleModule,
    KanbanBoardComponent,
    TaskListViewComponent,
    TaskDetailDrawerComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './board-page.component.html',
})
export class BoardPageComponent {
  readonly workspace = inject(WorkspaceContextService);
  readonly tasks = inject(TaskStoreService);

  setBoardView(view: BoardView): void {
    this.tasks.setBoardView(view);
  }

  addQuickTask(): void {
    this.tasks.addQuickTask();
  }

  onFilterInput(value: string): void {
    this.tasks.clearSmartSearch();
    this.tasks.searchQuery.set(value);
  }

  clearAiFilter(): void {
    this.tasks.clearSmartSearch();
    this.tasks.searchQuery.set('');
  }
}
