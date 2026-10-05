// Readable message from a failed API call. Errors use the contract envelope
// `{ success: false, error: { code, message } }`; falls back when there is none.
export function apiErrorMessage(err: unknown, fallback: string): string {
  // Locally raised errors (e.g. the view-only guard) carry their message directly.
  if (err instanceof Error && err.message) return err.message;
  const body = (err as { error?: { error?: { message?: string }; message?: string } })?.error;
  return body?.error?.message ?? body?.message ?? fallback;
}

/** Shown when a viewer tries to change project content. Matches the backend's wording. */
export const VIEW_ONLY_MESSAGE =
  'You have view-only access to this project. Ask an owner or admin for Member access to make changes.';
