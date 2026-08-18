import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatRippleModule } from '@angular/material/core';
import { RouterLink } from '@angular/router';
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
    DatePipe,
    MatRippleModule,
    KanbanBoardComponent,
    TaskListViewComponent,
    TaskDetailDrawerComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.scss',
})
export class BoardPageComponent {
  readonly workspace = inject(WorkspaceContextService);
  readonly tasks = inject(TaskStoreService);

  readonly currentDate = signal(new Date());

  /** Placeholder shapes for the loading state, mirroring the real column layout. */
  readonly skeletonColumns = [0, 1, 2];
  readonly skeletonCards = [0, 1, 2];

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

  reloadBoard(): void {
    const boardId = this.workspace.activeBoardId();
    if (boardId) this.tasks.loadBoard(boardId);
  }

  openProjectCreator(): void {
    this.workspace.isWorkspaceCreatorOpen.set(true);
  }
}
