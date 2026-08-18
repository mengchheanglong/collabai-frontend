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
    return this.apiClient.get<any>(`/boards/${boardId}?includeTasks=true`).pipe(
      map((res) => {
        const board = res?.board || res;
        const tasks = res?.tasks || board?.tasks || [];
        return {
          ...board,
          tasks,
        };
      }),
    );
  }
}
