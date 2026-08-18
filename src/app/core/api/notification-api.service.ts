import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ListResult } from './api-client.service';
import { map } from 'rxjs';
import type { NotificationDto } from './api.types';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly apiClient = inject(ApiClient);

  getNotifications(unreadOnly = false): Observable<ListResult<NotificationDto[]>> {
    const query = unreadOnly ? { unreadOnly: 'true' } : undefined;
    return this.apiClient
      .get<{ items: NotificationDto[]; meta: ListResult<NotificationDto[]>['meta'] }>('/notifications', query)
      .pipe(map(({ items, meta }) => ({ data: items, meta })));
  }

  markAsRead(notificationId: string): Observable<{ read: boolean }> {
    return this.apiClient.patch<{ read: boolean }>(`/notifications/${notificationId}/read`);
  }

  markAllAsRead(): Observable<{ updated: number }> {
    return this.apiClient.patch<{ updated: number }>('/notifications/read-all');
  }
}
