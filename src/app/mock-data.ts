import { Activity, Member, Project, Suggestion, Task } from './app.models';

export const members: Member[] = [
  { id: 'u1', name: 'Seoul', email: 'seoul@example.com', role: 'Admin', avatar: 'S', status: 'Active', projects: 6, joined: 'Jan 10, 2026' },
  { id: 'u2', name: 'Dara', email: 'dara@example.com', role: 'Admin', avatar: 'D', status: 'Active', projects: 5, joined: 'Jan 12, 2026' },
  { id: 'u3', name: 'Bora', email: 'bora@example.com', role: 'Member', avatar: 'B', status: 'Active', projects: 4, joined: 'Jan 15, 2026' },
  { id: 'u4', name: 'Lina', email: 'lina@example.com', role: 'Member', avatar: 'L', status: 'Active', projects: 3, joined: 'Jan 18, 2026' },
  { id: 'u5', name: 'Chanra', email: 'chanra@example.com', role: 'Member', avatar: 'C', status: 'Away', projects: 2, joined: 'Jan 20, 2026' },
  { id: 'u6', name: 'Pisey', email: 'pisey@example.com', role: 'Viewer', avatar: 'P', status: 'Offline', projects: 1, joined: 'Jan 26, 2026' },
];

export const projects: Project[] = [
  { id: 'p1', name: 'CollabAI Platform', team: 'Product Team', progress: 75, icon: 'C', accent: '#6d5dfc', members: ['S', 'D', 'B', 'L'] },
  { id: 'p2', name: 'Green Campus App', team: 'Design Team', progress: 60, icon: '🌿', accent: '#17c987', members: ['D', 'B', 'C'] },
  { id: 'p3', name: 'Marketing Website', team: 'Marketing Team', progress: 40, icon: '🚀', accent: '#ffb547', members: ['S', 'L'] },
  { id: 'p4', name: 'School Management', team: 'Development Team', progress: 90, icon: '🎓', accent: '#3388ff', members: ['S', 'D', 'B'] },
  { id: 'p5', name: 'Research Assistant', team: 'AI Team', progress: 55, icon: 'R', accent: '#a855f7', members: ['S', 'C'] },
];

export const tasks: Task[] = [
  { id: 'TAS-104', title: 'Build authentication module (API)', description: 'Create RESTful APIs for user authentication including register, login, logout, and refresh token.', status: 'in_progress', priority: 'high', assignee: 'Bora', reporter: 'Seoul', dueDate: 'May 18, 2026', project: 'CollabAI Platform', tags: ['Backend'], comments: 7, subtasks: [{ title: 'Design API endpoints', done: true }, { title: 'Implement register API', done: true }, { title: 'Implement login API', done: false }, { title: 'Implement refresh token API', done: false }] },
  { id: 'COL-123', title: 'Build project management module (API)', description: 'Create RESTful APIs for projects including create, update, delete, list, and project members.', status: 'in_progress', priority: 'high', assignee: 'Bora', reporter: 'Seoul', dueDate: 'May 18, 2026', project: 'CollabAI Platform', tags: ['Backend'], comments: 5, subtasks: [{ title: 'Create project schema', done: true }, { title: 'Create project model', done: true }, { title: 'Create CRUD APIs', done: false }] },
  { id: 'COL-201', title: 'Design landing page UI', description: 'Create responsive landing and authentication screens matching CollabAI visual language.', status: 'todo', priority: 'medium', assignee: 'Lina', reporter: 'Seoul', dueDate: 'May 22, 2026', project: 'CollabAI Platform', tags: ['Design'], comments: 2, subtasks: [{ title: 'Create login form', done: false }] },
  { id: 'COL-202', title: 'Implement task drag and drop', description: 'Use Angular CDK to move task cards across Kanban columns and sync status changes.', status: 'in_progress', priority: 'medium', assignee: 'Dara', reporter: 'Seoul', dueDate: 'May 19, 2026', project: 'CollabAI Platform', tags: ['Frontend'], comments: 2, subtasks: [{ title: 'Install CDK', done: true }, { title: 'Handle drop event', done: false }] },
  { id: 'COL-203', title: 'Test AI summary generation', description: 'Connect task comments to the AI summarizer endpoint and handle API failures gracefully.', status: 'review', priority: 'low', assignee: 'Pisey', reporter: 'Dara', dueDate: 'May 18, 2026', project: 'CollabAI Platform', tags: ['AI'], comments: 1, subtasks: [{ title: 'Create empty state', done: true }] },
  { id: 'COL-204', title: 'Initialize project with Node.js', description: 'Prepare backend project structure, environment config, and health endpoint.', status: 'done', priority: 'low', assignee: 'Seoul', reporter: 'Dara', dueDate: 'May 10, 2026', project: 'CollabAI Platform', tags: ['Backend'], comments: 0, subtasks: [{ title: 'Create package', done: true }] },
  { id: 'COL-205', title: 'Setup MongoDB schema', description: 'Create MongoDB models for users, projects, tasks, comments, and activities.', status: 'done', priority: 'high', assignee: 'Chanra', reporter: 'Seoul', dueDate: 'May 12, 2026', project: 'CollabAI Platform', tags: ['Database'], comments: 2, subtasks: [{ title: 'Users model', done: true }, { title: 'Tasks model', done: true }] },
  { id: 'COL-206', title: 'Integrate AI assistant for task suggestions', description: 'Expose UI controls for AI task description generation and subtask suggestions.', status: 'in_progress', priority: 'high', assignee: 'Lina', reporter: 'Seoul', dueDate: 'May 21, 2026', project: 'CollabAI Platform', tags: ['AI'], comments: 3, subtasks: [{ title: 'Create prompt UI', done: false }] },
  { id: 'COL-207', title: 'Write documentation for API endpoints', description: 'Document REST contracts for frontend and backend integration.', status: 'todo', priority: 'medium', assignee: 'Pisey', reporter: 'Seoul', dueDate: 'May 28, 2026', project: 'CollabAI Platform', tags: ['Docs'], comments: 1, subtasks: [{ title: 'Auth docs', done: true }, { title: 'Task docs', done: false }] },
];

export const activities: Activity[] = [
  { actor: 'Dara', text: 'updated a task: Login page redesign', time: '2m ago', type: 'task' },
  { actor: 'Bora', text: 'moved a task to Done: API integration', time: '15m ago', type: 'task' },
  { actor: 'AI Assistant', text: 'generated 5 new subtasks', time: '1h ago', type: 'ai' },
  { actor: 'Sreynich', text: 'commented on Database schema design', time: '2h ago', type: 'comment' },
  { actor: 'You', text: 'created a new project: Research Assistant', time: '3h ago', type: 'project' },
];

export const suggestions: Suggestion[] = [
  { title: 'Add buffer time to your timeline', body: 'The User Authentication task is close to the deadline. Adding 2 days can reduce delivery risk.', category: 'Timeline', impact: 'High', action: 'Apply Suggestion' },
  { title: 'Reassign task for better workload balance', body: 'Seoul has 8 high-priority tasks. Consider moving Design Login Page to another member.', category: 'Workload', impact: 'Medium', action: 'View Options' },
  { title: 'Break down a large task', body: 'Authentication System is a large task. Breaking it into subtasks helps track progress better.', category: 'Tasks', impact: 'Medium', action: 'Break Down' },
  { title: 'Potential delay detected', body: '2 tasks are at risk of missing the deadline. Review blockers and update priorities.', category: 'Risk', impact: 'High', action: 'View Risks' },
  { title: 'Improve team skills', body: 'Your team can benefit from learning API security before auth implementation.', category: 'Team', impact: 'Low', action: 'View Courses' },
];
