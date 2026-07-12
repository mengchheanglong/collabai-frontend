import type { Priority } from '../models/task.models';

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function priorityRank(priority: Priority): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[priority];
}

export function priorityClass(priority: Priority): string {
  return `priority-${priority}`;
}
