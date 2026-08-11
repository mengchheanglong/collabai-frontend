import { Injectable, computed, inject, signal } from '@angular/core';
import { NotificationApiService } from '../api/notification-api.service';
import type { NotificationDto } from '../api/api.types';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  time: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationStoreService {
  private readonly notificationApi = inject(NotificationApiService);

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);
  readonly isLoading = signal(false);

  loadNotifications(): void {
    this.isLoading.set(true);
    this.notificationApi.getNotifications().subscribe({
      next: (res) => {
        this.notifications.set(res.data.map(toAppNotification));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  markAsRead(id: string): void {
    this.notificationApi.markAsRead(id).subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
      },
    });
  }

  markAllAsRead(): void {
    this.notificationApi.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
      },
    });
  }
}

function toAppNotification(dto: NotificationDto): AppNotification {
  return {
    id: dto._id,
    type: dto.type,
    title: dto.title,
    body: dto.body,
    read: dto.read,
    time: dto.createdAt,
  };
}
