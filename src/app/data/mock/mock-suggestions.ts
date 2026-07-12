import type { Suggestion } from '../../shared/models/suggestion.models';

export const suggestions: Suggestion[] = [
  { id: 's1', title: 'Add buffer time to your timeline', body: 'Authentication is close to the deadline. Adding 2 days can reduce delivery risk without blocking the board.', category: 'Timeline', impact: 'High', action: 'Apply buffer' },
  { id: 's2', title: 'Rebalance high-priority load', body: 'Bora owns multiple high-priority backend tasks. Consider moving one API task to Chanra this sprint.', category: 'Workload', impact: 'Medium', action: 'View options' },
  { id: 's3', title: 'Break down a large task', body: 'Build authentication module is large. Generating subtasks improves tracking and demos better.', category: 'Tasks', impact: 'Medium', action: 'Generate subtasks' },
  { id: 's4', title: 'Potential delay detected', body: '2 tasks are at risk of missing the deadline. Review blockers and bump priorities if needed.', category: 'Risk', impact: 'High', action: 'View risks' },
  { id: 's5', title: 'Document before handoff', body: 'API docs still have open sections. Completing them this week will unblock frontend integration.', category: 'Team', impact: 'Low', action: 'Open docs task' },
];
