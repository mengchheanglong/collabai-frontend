import type { Priority } from '../models/task.models';

export function initials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function priorityRank(priority: Priority): number {
  const ranks: Record<Priority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return ranks[priority] ?? 0;
}

export function priorityClass(priority: Priority): string {
  return `priority-${priority}`;
}
