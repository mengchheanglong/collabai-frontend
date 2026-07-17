import type { CommentPreview } from '../../shared/models/comment.models';

export const taskComments: Record<string, CommentPreview[]> = {
  'TAS-104': [
    { author: 'Seoul', body: 'Please mirror the auth envelope from API-CONTRACT.md exactly.', time: '1h ago' },
    { author: 'Bora', body: 'Login works locally — finishing refresh token next.', time: '40m ago' },
    { author: 'AI Assistant', body: 'Suggested next: add rate limiting on /auth/login.', time: '20m ago' },
  ],
  'COL-206': [
    { author: 'Lina', body: 'AI buttons should never expose provider keys — call backend only.', time: '3h ago' },
    { author: 'Dara', body: 'Can we put Generate subtasks in the task drawer?', time: '2h ago' },
  ],
};
