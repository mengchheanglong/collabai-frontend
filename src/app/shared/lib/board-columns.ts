import type { TaskStatus } from '../models/task.models';

export const BOARD_COLUMNS: Array<{ key: TaskStatus; label: string }> = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

export function statusLabel(status: TaskStatus): string {
  return BOARD_COLUMNS.find((c) => c.key === status)?.label ?? status;
}

export function columnConnectedIds(): string[] {
  return BOARD_COLUMNS.map((c) => `col-${c.key}`);
}
