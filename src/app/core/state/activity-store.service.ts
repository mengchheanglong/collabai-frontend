import { Injectable, signal } from '@angular/core';
import { activities as seedActivities } from '../../data/mock/mock-activities';
import type { Activity } from '../../shared/models/activity.models';

@Injectable({ providedIn: 'root' })
export class ActivityStoreService {
  readonly activities = signal<Activity[]>([...seedActivities]);
}
