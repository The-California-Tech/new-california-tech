/**
 * The /submit draft, kept in this browser until it is sent.
 *
 * Name and email are deliberately not stored: the browser's own autofill
 * already remembers those for people who want it, and a shared lab computer
 * should not hand the next person someone else's address.
 */
export interface SubmissionDraft {
  title: string;
  category: string;
  body: string;
}

const KEY = 'tech:submit-draft';

export function loadDraft(): Partial<SubmissionDraft> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // Private browsing, a full quota, or a value from an older shape.
    return {};
  }
}

export function saveDraft(draft: SubmissionDraft): void {
  try {
    if (!draft.title && !draft.body) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Losing autosave is not worth interrupting someone's writing over.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* as above */
  }
}
