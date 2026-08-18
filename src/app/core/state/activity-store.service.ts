import { Injectable, inject, signal } from '@angular/core';
import type { Activity } from '../../shared/models/activity.models';
import { ActivityApiService, type ActivityDto } from '../api/activity-api.service';

@Injectable({ providedIn: 'root' })
export class ActivityStoreService {
  private readonly activityApi = inject(ActivityApiService);

  /** Start empty; populated by loadForProject() called from the dashboard. */
  readonly activities = signal<Activity[]>([]);

  loadForProject(projectId: string): void {
    if (!projectId) {
      this.activities.set([]);
      return;
    }
    this.activityApi.getProjectActivity(projectId).subscribe({
      next: (dtos) => this.activities.set((dtos || []).map(toActivity)),
      error: () => {
        this.activities.set([]);
      },
    });
  }
}

/** Map backend ActivityDto → frontend Activity display model. */
function toActivity(dto: ActivityDto): Activity {
  const typeMap: Record<string, Activity['type']> = {
    'task.created':    'task',
    'task.updated':    'task',
    'task.moved':      'task',
    'task.deleted':    'task',
    'comment.created': 'comment',
    'comment.updated': 'comment',
    'comment.deleted': 'comment',
    'project.created': 'project',
    'project.updated': 'project',
    'project.deleted': 'project',
    'member.added':    'project',
    'member.updated':  'project',
    'member.removed':  'project',
  };
  const isAi = dto.type?.startsWith('ai.');
  return {
    actor: isAi ? 'AI Assistant' : (dto.actor?.name ?? 'Unknown'),
    text: dto.message ?? '',
    time: dto.createdAt,
    type: isAi ? 'ai' : (typeMap[dto.type] ?? 'task'),
  };
}
