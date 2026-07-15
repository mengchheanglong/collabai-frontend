import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import type {
  AiDescriptionRequest,
  AiDescriptionResponse,
  AiSearchFilters,
  AiSearchTasksRequest,
  AiSearchTasksResponse,
  AiSubtasksRequest,
  AiSubtasksResponse,
  AiSummarizeCommentsRequest,
  AiSummarizeCommentsResponse,
} from '../../shared/models/ai.models';
import type { CommentPreview } from '../../shared/models/comment.models';
import type { Priority, Task, TaskStatus } from '../../shared/models/task.models';

/**
 * Contract-aligned AI client.
 * MVP uses local mock logic matching POST /api/v1/ai/* shapes.
 * Swap internals for HttpClient when backend Phase 5 lands — keep method signatures.
 *
 * Pure service: callers pass task/comment context so we avoid circular store deps.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  generateSubtasks(body: AiSubtasksRequest): Observable<AiSubtasksResponse> {
    const count = Math.min(10, Math.max(3, body.count ?? 5));
    const title = body.title.trim() || 'this task';
    const seed = [
      `Clarify acceptance criteria for ${title}`,
      `Scaffold the main implementation path`,
      `Wire API integration and error states`,
      `Add unit and smoke tests`,
      `Document the change and handoff notes`,
      `Review edge cases and empty states`,
      `Polish UI loading and success feedback`,
      `Verify auth and permission constraints`,
    ];
    const lower = `${body.title} ${body.description ?? ''}`.toLowerCase();
    if (lower.includes('auth') || lower.includes('login')) {
      seed.unshift(
        'Create login route and page component',
        'Build email/password form with validation',
        'Connect form to auth service login method',
        'Store JWT token securely in frontend storage',
        'Redirect user to dashboard after login',
      );
    } else if (lower.includes('ai') || lower.includes('search')) {
      seed.unshift(
        'Define AiService methods against API contract',
        'Build smart search UI with filter chips',
        'Handle loading, empty, and rate-limit states',
        'Map NL query into structured filters',
      );
    }
    return of({ subtasks: [...new Set(seed)].slice(0, count) }).pipe(delay(900));
  }

  generateDescription(body: AiDescriptionRequest): Observable<AiDescriptionResponse> {
    const title = body.title.trim() || 'Untitled task';
    const current = (body.currentDescription ?? '').trim();
    let description: string;

    if (body.mode === 'shorten') {
      description =
        current.length > 0
          ? current.split(/[.!?]/)[0].trim().slice(0, 160) + (current.length > 160 ? '…' : '.')
          : `Deliver ${title} with clear scope, validation, and test coverage.`;
    } else if (body.mode === 'improve' && current) {
      description = `${current}\n\nExpected outcome: ship a clear, testable change that matches the API contract. Include loading, error, and empty states. Keep provider keys on the backend only.`;
    } else {
      description = `Create a complete implementation for “${title}”. Cover happy path, validation, loading and error UI, and integration with the existing CollabAI services. Keep scope demo-friendly and aligned with docs/API-CONTRACT.md.`;
    }

    return of({ description }).pipe(delay(750));
  }

  summarizeComments(
    body: AiSummarizeCommentsRequest,
    comments: CommentPreview[] = [],
  ): Observable<AiSummarizeCommentsResponse> {
    void body.taskId;
    let summary: string;

    if (comments.length === 0) {
      summary = 'No comments yet. Start the discussion so the AI can surface decisions and blockers.';
    } else {
      const lines = comments
        .slice(0, 6)
        .map((c) => `${c.author}: ${c.body}`)
        .join(' ');
      const mentionsBlocker = /block|wait|pending|fail/i.test(lines);
      const mentionsDone = /ready|done|ship|merged|finish/i.test(lines);
      summary = `Team discussed recent progress on this task. ${
        mentionsDone ? 'Some pieces appear ready to integrate. ' : ''
      }${
        mentionsBlocker ? 'Open blockers or pending work were mentioned. ' : ''
      }Next: confirm owners and close remaining gaps before moving to done.`;
    }

    return of({ summary }).pipe(delay(850));
  }

  /**
   * POST /ai/search-tasks mock.
   * Pass the project/workspace task pool from the caller (TaskStore).
   */
  searchTasks(body: AiSearchTasksRequest, pool: Task[]): Observable<AiSearchTasksResponse> {
    void body.projectId;
    const query = body.query.trim();
    const filters = this.parseQuery(query);
    const tasks = this.applyFilters(pool, filters);
    return of({ interpretedQuery: filters, tasks }).pipe(delay(700));
  }

  applyFilters(tasks: Task[], filters: AiSearchFilters): Task[] {
    return tasks.filter((task) => {
      if (filters.text) {
        const q = filters.text.toLowerCase();
        const hay =
          `${task.title} ${task.description} ${task.id} ${task.assignee} ${task.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filters.labels?.length) {
        const labels = filters.labels.map((l) => l.toLowerCase());
        const tags = task.tags.map((t) => t.toLowerCase());
        if (!labels.some((l) => tags.some((t) => t.includes(l) || l.includes(t)))) return false;
      }

      if (filters.status?.length && !filters.status.includes(task.status)) return false;
      if (filters.statusNot?.length && filters.statusNot.includes(task.status)) return false;

      if (filters.priority?.length) {
        const wanted = new Set(
          filters.priority.map((p) => (p === 'urgent' ? 'critical' : p) as Priority),
        );
        if (!wanted.has(task.priority)) return false;
      }

      if (filters.assigneeName) {
        if (!task.assignee.toLowerCase().includes(filters.assigneeName.toLowerCase())) return false;
      }

      if (filters.dueRange) {
        if (!this.matchesDueRange(task.dueDate, filters.dueRange)) return false;
      }

      return true;
    });
  }

  private parseQuery(query: string): AiSearchFilters {
    const q = query.toLowerCase();
    const filters: AiSearchFilters = {};

    const labels: string[] = [];
    const labelMap: Record<string, string> = {
      frontend: 'Frontend',
      backend: 'Backend',
      design: 'Design',
      ui: 'UI',
      ai: 'AI',
      security: 'Security',
      docs: 'Docs',
      qa: 'QA',
      database: 'Database',
      marketing: 'Marketing',
    };
    for (const [key, label] of Object.entries(labelMap)) {
      if (q.includes(key)) labels.push(label);
    }
    if (labels.length) filters.labels = [...new Set(labels)];

    const status: TaskStatus[] = [];
    const statusNot: TaskStatus[] = [];
    if (/\bnot done\b|\bunfinished\b|\bopen\b|\bincomplete\b/.test(q)) {
      statusNot.push('done');
    } else if (/\bdone\b|\bcompleted\b|\bfinished\b/.test(q)) {
      status.push('done');
    }
    if (/\bin progress\b|\bwip\b/.test(q)) status.push('in_progress');
    if (/\breview\b/.test(q)) status.push('review');
    if (/\btodo\b|\bto do\b|\bbacklog\b/.test(q)) status.push('todo');
    if (status.length) filters.status = status;
    if (statusNot.length) filters.statusNot = statusNot;

    const priority: Array<Priority | 'urgent'> = [];
    if (/\bcritical\b|\burgent\b/.test(q)) priority.push('critical', 'urgent');
    if (/\bhigh\b/.test(q)) priority.push('high');
    if (/\bmedium\b/.test(q)) priority.push('medium');
    if (/\blow\b/.test(q)) priority.push('low');
    if (priority.length) filters.priority = [...new Set(priority)];

    if (/\boverdue\b|\blate\b|\bpast due\b/.test(q)) {
      filters.dueRange = 'overdue';
    } else if (/\btoday\b/.test(q)) {
      filters.dueRange = 'today';
    } else if (/\bthis week\b|\bweek\b/.test(q)) {
      filters.dueRange = 'this_week';
    }

    const people = ['bora', 'dara', 'lina', 'seoul', 'chanra', 'pisey'];
    for (const name of people) {
      if (q.includes(name)) {
        filters.assigneeName = name[0].toUpperCase() + name.slice(1);
        break;
      }
    }

    let residual = query
      .replace(
        /\b(frontend|backend|design|ui|ai|security|docs|qa|database|marketing|not done|unfinished|open|incomplete|done|completed|finished|in progress|wip|review|todo|to do|backlog|critical|urgent|high|medium|low|overdue|late|past due|today|this week|week|tasks?|that are|which are|show me|find|search|for|with|and|or|the|a|an)\b/gi,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
    for (const name of people) {
      residual = residual.replace(new RegExp(name, 'ig'), '').trim();
    }
    if (residual.length >= 2) filters.text = residual;

    if (
      !filters.labels &&
      !filters.status &&
      !filters.statusNot &&
      !filters.priority &&
      !filters.dueRange &&
      !filters.assigneeName &&
      !filters.text &&
      query.trim()
    ) {
      filters.text = query.trim();
    }

    return filters;
  }

  private matchesDueRange(dueDate: string, range: NonNullable<AiSearchFilters['dueRange']>): boolean {
    if (!dueDate || dueDate === 'TBD') return range !== 'overdue';
    const due = Date.parse(dueDate);
    if (Number.isNaN(due)) return true;

    // Reference "today" aligned with mock data era (May 2026 demos)
    const now = new Date('2026-05-17T12:00:00');
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    if (range === 'today') return due >= startOfToday.getTime() && due < endOfToday.getTime();
    if (range === 'this_week') return due >= startOfToday.getTime() && due < endOfWeek.getTime();
    if (range === 'overdue') return due < startOfToday.getTime();
    return true;
  }
}
