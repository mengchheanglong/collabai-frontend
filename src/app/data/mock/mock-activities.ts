import type { Activity } from '../../shared/models/activity.models';

export const activities: Activity[] = [
  { actor: 'Dara', text: 'updated a task: Login page redesign', time: '2m ago', type: 'task' },
  { actor: 'Bora', text: 'moved a task to Done: API integration', time: '15m ago', type: 'task' },
  { actor: 'AI Assistant', text: 'generated 5 new subtasks for auth module', time: '1h ago', type: 'ai' },
  { actor: 'Sreynich', text: 'commented on Database schema design', time: '2h ago', type: 'comment' },
  { actor: 'You', text: 'created a new project: Research Assistant', time: '3h ago', type: 'project' },
  { actor: 'Lina', text: 'assigned you: Integrate AI assistant', time: '4h ago', type: 'task' },
  { actor: 'Chanra', text: 'completed Setup MongoDB schema', time: '1d ago', type: 'task' },
];
