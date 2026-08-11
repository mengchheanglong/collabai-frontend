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
<<<<<<< HEAD
  return { urgent: 4, high: 3, medium: 2, low: 1 }[priority];
=======
  const ranks: Record<Priority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return ranks[priority] ?? 0;
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
}

export function priorityClass(priority: Priority): string {
  return `priority-${priority}`;
}
