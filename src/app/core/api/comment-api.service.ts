import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CommentDto } from './api.types';
import { ApiClient } from './api-client.service';

@Injectable({
  providedIn: 'root',
})
export class CommentApiService {
  private apiClient = inject(ApiClient);

  getComments(taskId: string): Observable<CommentDto[]> {
    return this.apiClient
      .get<{ comments: CommentDto[] }>(`/tasks/${taskId}/comments`)
      .pipe(map(({ comments }) => comments));
  }

  createComment(taskId: string, body: string): Observable<{ comment: CommentDto }> {
    return this.apiClient.post<{ comment: CommentDto }>(`/tasks/${taskId}/comments`, { body });
  }

  updateComment(commentId: string, body: string): Observable<{ comment: CommentDto }> {
    return this.apiClient.patch<{ comment: CommentDto }>(`/comments/${commentId}`, { body });
  }

  deleteComment(commentId: string): Observable<void> {
    return this.apiClient.delete<void>(`/comments/${commentId}`);
  }
}
