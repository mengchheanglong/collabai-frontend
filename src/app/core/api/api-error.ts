// Readable message from a failed API call. Errors use the contract envelope
// `{ success: false, error: { code, message } }`; falls back when there is none.
export const OFFLINE_MESSAGE =
  "You're offline — this needs an internet connection. Try again when you're back online.";

export function apiErrorMessage(err: unknown, fallback: string): string {
  // Locally raised errors (e.g. the view-only guard) carry their message directly.
  if (err instanceof Error && err.message) return err.message;
  // Network unreachable: say so, instead of a vague failure.
  const status = (err as { status?: number } | null)?.status;
  if (status === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return OFFLINE_MESSAGE;
  }
  const body = (err as { error?: { error?: { message?: string }; message?: string } })?.error;
  return body?.error?.message ?? body?.message ?? fallback;
}

/** Shown when someone other than the assignee (or an owner/admin) changes a task. */
export const NOT_YOUR_TASK_MESSAGE =
  "Only the task's assignee or a project owner/admin can change this task.";

/** Shown when a viewer tries to change project content. Matches the backend's wording. */
export const VIEW_ONLY_MESSAGE =
  'You have view-only access to this project. Ask an owner or admin for Member access to make changes.';
