import { Activity, CommentPreview, Member, Project, Suggestion, Task } from './app.models';

export const members: Member[] = [
  { id: 'u1', name: 'Seoul', email: 'seoul@example.com', role: 'Admin', avatar: 'S', status: 'Active', projects: 6, joined: 'Jan 10, 2026', color: '#3b82f6' },
  { id: 'u2', name: 'Dara', email: 'dara@example.com', role: 'Admin', avatar: 'D', status: 'Active', projects: 5, joined: 'Jan 12, 2026', color: '#06b6d4' },
  { id: 'u3', name: 'Bora', email: 'bora@example.com', role: 'Member', avatar: 'B', status: 'Active', projects: 4, joined: 'Jan 15, 2026', color: '#22c55e' },
  { id: 'u4', name: 'Lina', email: 'lina@example.com', role: 'Member', avatar: 'L', status: 'Active', projects: 3, joined: 'Jan 18, 2026', color: '#a78bfa' },
  { id: 'u5', name: 'Chanra', email: 'chanra@example.com', role: 'Member', avatar: 'C', status: 'Away', projects: 2, joined: 'Jan 20, 2026', color: '#f59e0b' },
  { id: 'u6', name: 'Pisey', email: 'pisey@example.com', role: 'Viewer', avatar: 'P', status: 'Offline', projects: 1, joined: 'Jan 26, 2026', color: '#64748b' },
];

export const projects: Project[] = [
  { id: 'p1', name: 'CollabAI Platform', team: 'Product Team', progress: 75, icon: 'C', accent: '#3b82f6', members: ['S', 'D', 'B', 'L'], description: 'Core product sprint — auth, boards, AI, realtime.' },
  { id: 'p2', name: 'Green Campus App', team: 'Design Team', progress: 60, icon: 'G', accent: '#22c55e', members: ['D', 'B', 'C'], description: 'Campus sustainability tracking for students.' },
  { id: 'p3', name: 'Marketing Website', team: 'Marketing Team', progress: 40, icon: 'M', accent: '#f59e0b', members: ['S', 'L'], description: 'Launch site, copy, and campaign landing pages.' },
  { id: 'p4', name: 'School Management', team: 'Development Team', progress: 90, icon: 'S', accent: '#06b6d4', members: ['S', 'D', 'B'], description: 'Admin tools for classes, grades, and attendance.' },
  { id: 'p5', name: 'Research Assistant', team: 'AI Team', progress: 55, icon: 'R', accent: '#a78bfa', members: ['S', 'C'], description: 'Personal AI experiments and paper summarizer.' },
];

export const tasks: Task[] = [
  { id: 'TAS-104', title: 'Build authentication module (API)', description: 'Create RESTful APIs for user authentication including register, login, logout, and refresh token. Enforce bcrypt hashing and JWT response envelope.', status: 'in_progress', priority: 'high', assignee: 'Bora', reporter: 'Seoul', dueDate: 'May 18, 2026', project: 'CollabAI Platform', tags: ['Backend', 'Security'], comments: 7, subtasks: [{ title: 'Design API endpoints', done: true }, { title: 'Implement register API', done: true }, { title: 'Implement login API', done: false }, { title: 'Implement refresh token API', done: false }] },
  { id: 'COL-123', title: 'Build project management module (API)', description: 'Create RESTful APIs for projects including create, update, delete, list, and project members with role checks.', status: 'in_progress', priority: 'high', assignee: 'Bora', reporter: 'Seoul', dueDate: 'May 18, 2026', project: 'CollabAI Platform', tags: ['Backend'], comments: 5, subtasks: [{ title: 'Create project schema', done: true }, { title: 'Create project model', done: true }, { title: 'Create CRUD APIs', done: false }] },
  { id: 'COL-201', title: 'Design landing page UI', description: 'Create responsive landing and authentication screens matching CollabAI visual language — purple brand, dark surfaces, soft glass panels.', status: 'todo', priority: 'medium', assignee: 'Lina', reporter: 'Seoul', dueDate: 'May 22, 2026', project: 'CollabAI Platform', tags: ['Design', 'UI'], comments: 2, subtasks: [{ title: 'Create login form', done: false }, { title: 'Build marketing hero', done: false }] },
  { id: 'COL-202', title: 'Implement task drag and drop', description: 'Use Angular CDK to move task cards across Kanban columns and sync status changes with optimistic UI.', status: 'in_progress', priority: 'medium', assignee: 'Dara', reporter: 'Seoul', dueDate: 'May 19, 2026', project: 'CollabAI Platform', tags: ['Frontend'], comments: 2, subtasks: [{ title: 'Install CDK', done: true }, { title: 'Handle drop event', done: false }, { title: 'Optimistic rollback', done: false }] },
  { id: 'COL-203', title: 'Test AI summary generation', description: 'Connect task comments to the AI summarizer endpoint and handle API failures gracefully with empty and error states.', status: 'review', priority: 'low', assignee: 'Pisey', reporter: 'Dara', dueDate: 'May 18, 2026', project: 'CollabAI Platform', tags: ['AI', 'QA'], comments: 1, subtasks: [{ title: 'Create empty state', done: true }, { title: 'Add error snackbar', done: false }] },
  { id: 'COL-204', title: 'Initialize project with Node.js', description: 'Prepare backend project structure, environment config, and health endpoint for local and cloud deploys.', status: 'done', priority: 'low', assignee: 'Seoul', reporter: 'Dara', dueDate: 'May 10, 2026', project: 'CollabAI Platform', tags: ['Backend'], comments: 0, subtasks: [{ title: 'Create package', done: true }] },
  { id: 'COL-205', title: 'Setup MongoDB schema', description: 'Create MongoDB models for users, projects, tasks, comments, and activities with proper indexes.', status: 'done', priority: 'high', assignee: 'Chanra', reporter: 'Seoul', dueDate: 'May 12, 2026', project: 'CollabAI Platform', tags: ['Database'], comments: 2, subtasks: [{ title: 'Users model', done: true }, { title: 'Tasks model', done: true }] },
  { id: 'COL-206', title: 'Integrate AI assistant for task suggestions', description: 'Expose UI controls for AI task description generation and subtask suggestions. All AI keys stay on the backend.', status: 'in_progress', priority: 'high', assignee: 'Lina', reporter: 'Seoul', dueDate: 'May 21, 2026', project: 'CollabAI Platform', tags: ['AI', 'Frontend'], comments: 3, subtasks: [{ title: 'Create prompt UI', done: false }, { title: 'Wire AiService', done: false }] },
  { id: 'COL-207', title: 'Write documentation for API endpoints', description: 'Document REST contracts for frontend and backend integration, including envelopes and error codes.', status: 'todo', priority: 'medium', assignee: 'Pisey', reporter: 'Seoul', dueDate: 'May 28, 2026', project: 'CollabAI Platform', tags: ['Docs'], comments: 1, subtasks: [{ title: 'Auth docs', done: true }, { title: 'Task docs', done: false }] },
  { id: 'GRN-101', title: 'Map campus recycling zones', description: 'Collect GPS markers for recycling bins and display them on the campus map view.', status: 'in_progress', priority: 'medium', assignee: 'Dara', reporter: 'Bora', dueDate: 'May 25, 2026', project: 'Green Campus App', tags: ['Maps'], comments: 2, subtasks: [{ title: 'Survey locations', done: true }, { title: 'Render map pins', done: false }] },
  { id: 'GRN-102', title: 'Design eco scorecard', description: 'Visual scorecard showing weekly sustainability progress for each dorm.', status: 'todo', priority: 'low', assignee: 'Chanra', reporter: 'Dara', dueDate: 'May 30, 2026', project: 'Green Campus App', tags: ['Design'], comments: 0, subtasks: [{ title: 'Sketch wireframes', done: false }] },
  { id: 'MKT-88', title: 'Ship product hero section', description: 'Launch-ready hero with product mock, CTA, and social proof for the marketing site.', status: 'in_progress', priority: 'high', assignee: 'Lina', reporter: 'Seoul', dueDate: 'May 20, 2026', project: 'Marketing Website', tags: ['Marketing', 'UI'], comments: 4, subtasks: [{ title: 'Copy draft', done: true }, { title: 'Motion polish', done: false }] },
  { id: 'MKT-89', title: 'Collect launch testimonials', description: 'Interview early users and format quotes for the website social proof strip.', status: 'todo', priority: 'medium', assignee: 'Seoul', reporter: 'Lina', dueDate: 'May 24, 2026', project: 'Marketing Website', tags: ['Content'], comments: 1, subtasks: [{ title: 'Send interview invites', done: false }] },
  { id: 'SCH-44', title: 'Attendance export CSV', description: 'Allow teachers to export monthly attendance as CSV with filters.', status: 'review', priority: 'medium', assignee: 'Bora', reporter: 'Seoul', dueDate: 'May 17, 2026', project: 'School Management', tags: ['Backend'], comments: 3, subtasks: [{ title: 'Query filters', done: true }, { title: 'CSV serializer', done: true }] },
  { id: 'RES-12', title: 'Paper summarizer prompt tuning', description: 'Improve prompt quality for research paper summaries under 150 words.', status: 'todo', priority: 'high', assignee: 'Chanra', reporter: 'Seoul', dueDate: 'May 26, 2026', project: 'Research Assistant', tags: ['AI'], comments: 2, subtasks: [{ title: 'Collect sample papers', done: true }, { title: 'A/B prompt variants', done: false }] },
];

export const activities: Activity[] = [
  { actor: 'Dara', text: 'updated a task: Login page redesign', time: '2m ago', type: 'task' },
  { actor: 'Bora', text: 'moved a task to Done: API integration', time: '15m ago', type: 'task' },
  { actor: 'AI Assistant', text: 'generated 5 new subtasks for auth module', time: '1h ago', type: 'ai' },
  { actor: 'Sreynich', text: 'commented on Database schema design', time: '2h ago', type: 'comment' },
  { actor: 'You', text: 'created a new project: Research Assistant', time: '3h ago', type: 'project' },
  { actor: 'Lina', text: 'assigned you: Integrate AI assistant', time: '4h ago', type: 'task' },
  { actor: 'Chanra', text: 'completed Setup MongoDB schema', time: '1d ago', type: 'task' },
];

export const suggestions: Suggestion[] = [
  { id: 's1', title: 'Add buffer time to your timeline', body: 'Authentication is close to the deadline. Adding 2 days can reduce delivery risk without blocking the board.', category: 'Timeline', impact: 'High', action: 'Apply buffer' },
  { id: 's2', title: 'Rebalance high-priority load', body: 'Bora owns multiple high-priority backend tasks. Consider moving one API task to Chanra this sprint.', category: 'Workload', impact: 'Medium', action: 'View options' },
  { id: 's3', title: 'Break down a large task', body: 'Build authentication module is large. Generating subtasks improves tracking and demos better.', category: 'Tasks', impact: 'Medium', action: 'Generate subtasks' },
  { id: 's4', title: 'Potential delay detected', body: '2 tasks are at risk of missing the deadline. Review blockers and bump priorities if needed.', category: 'Risk', impact: 'High', action: 'View risks' },
  { id: 's5', title: 'Document before handoff', body: 'API docs still have open sections. Completing them this week will unblock frontend integration.', category: 'Team', impact: 'Low', action: 'Open docs task' },
];

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

export const aiPromptChips = [
  'Summarize this sprint',
  'Find blocked tasks',
  'Suggest subtasks for auth',
  'Who has the most work?',
  'Improve task descriptions',
];
