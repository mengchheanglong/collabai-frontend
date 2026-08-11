// src/app/core/api/board-api.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BoardDto, BoardWithTasksDto, TaskDto } from './api.types';
import { ApiClient } from './api-client.service';

@Injectable({
  providedIn: 'root',
})
export class BoardApiService {
  private apiClient = inject(ApiClient);

  listBoards(projectId: string): Observable<BoardDto[]> {
    return this.apiClient.get<BoardDto[]>(`/projects/${projectId}/boards`);
  }

  getBoardWithTasks(boardId: string): Observable<BoardWithTasksDto> {
    return this.apiClient.get<{ board: BoardDto; tasks: TaskDto[] }>(`/boards/${boardId}?includeTasks=true`).pipe(
      map(res => ({
        ...res.board,
        tasks: res.tasks
      }))
    );
  }
}
