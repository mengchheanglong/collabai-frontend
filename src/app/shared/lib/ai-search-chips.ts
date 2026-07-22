import type { AiSearchChip, AiSearchFilters } from '../models/ai.models';

export function chipsFromFilters(filters: AiSearchFilters): AiSearchChip[] {
  const chips: AiSearchChip[] = [];

  for (const label of filters.labels ?? []) {
    chips.push({ key: `label:${label}`, label, tone: 'cyan' });
  }

  for (const status of filters.status ?? []) {
    chips.push({
      key: `status:${status}`,
      label: status.replace('_', ' '),
      tone: status === 'done' ? 'green' : 'brand',
    });
  }

  for (const status of filters.statusNot ?? []) {
    chips.push({
      key: `statusNot:${status}`,
      label: `not ${status.replace('_', ' ')}`,
      tone: 'amber',
    });
  }

  for (const p of filters.priority ?? []) {
    const label = p === 'urgent' ? 'critical' : p;
    chips.push({
      key: `priority:${p}`,
      label: `${label} priority`,
      tone: label === 'high' || label === 'critical' ? 'red' : 'default',
    });
  }

  if (filters.dueRange) {
    const map: Record<string, string> = {
      today: 'due today',
      this_week: 'due this week',
      overdue: 'overdue',
    };
    chips.push({
      key: `due:${filters.dueRange}`,
      label: map[filters.dueRange] ?? filters.dueRange,
      tone: filters.dueRange === 'overdue' ? 'red' : 'amber',
    });
  }

  if (filters.assigneeName) {
    chips.push({
      key: `assignee:${filters.assigneeName}`,
      label: `assigned to ${filters.assigneeName}`,
      tone: 'brand',
    });
  }

  if (filters.text) {
    chips.push({ key: `text:${filters.text}`, label: `“${filters.text}”`, tone: 'default' });
  }

  return chips;
}

export const SMART_SEARCH_PROMPTS = [
  'frontend tasks not done',
  'high priority due this week',
  'AI tasks assigned to Lina',
  'overdue backend work',
  'tasks in review',
] as const;
