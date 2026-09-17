/**
 * Date parsing utilities for California Tech's issue-based dates.
 *
 * California Tech publishes articles with dates in a specific format:
 * "January 20, 2023" or similar date strings in the Issue property.
 */

/**
 * Parse a California Tech issue date string into an ISO timestamp.
 *
 * The Issue property contains dates like "January 20, 2023".
 * This function parses them and sets the time to 7:00 AM PST (14:00 UTC).
 *
 * @param issueString - The issue date string (e.g., "January 20, 2023")
 * @returns ISO timestamp string or null if parsing fails
 *
 * @example
 * parseTechIssueDate("January 20, 2023")
 * // Returns: "2023-01-20T14:00:00.000Z"
 */
/**
 * Accepted Issue formats. Deliberately strict -- see parseTechIssueDate.
 *   "January 20, 2023" / "Jan 20 2023"
 *   "2023-01-20"
 *   "1/20/2023"
 */
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const NAMED_MONTH = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/;
/**
 * Day-first with a named month: "2 June 2026", "2nd Jun. 2026".
 *
 * Unambiguous because the month is spelled, unlike the slashed form. This was
 * missing from the first strict version, which rejected "2 June 2026" outright
 * -- a regression, since the old `new Date()` parser read it correctly. Being
 * strict is right, but only about genuinely malformed input.
 */
const DAY_FIRST = /^(\d{1,2})(?:st|nd|rd|th)?\.?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const US_SLASHED = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Build the 7 AM PST instant for a Y/M/D, or null if it is not a real date. */
function pacificMorning(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T07:00:00-07:00`);
  if (Number.isNaN(date.getTime())) return null;

  // Catches overflow like February 30, which Date silently rolls forward into
  // March rather than rejecting.
  const rolled = new Date(`${iso}T12:00:00Z`);
  if (rolled.getUTCDate() !== day || rolled.getUTCMonth() + 1 !== month) return null;

  return date.toISOString();
}

export function parseTechIssueDate(issueString: string): string | null {
  if (!issueString || typeof issueString !== 'string') {
    return null;
  }

  const trimmed = issueString.trim();

  /*
   * Parsed by explicit pattern rather than `new Date(...)`.
   *
   * Date's fallback parsing is implementation-defined for non-ISO input and
   * does not fail on partial dates -- it invents the missing parts, which for
   * an archive is worse than refusing:
   *
   *   "March 2023" -> 2023-03-01     (a day that was never an issue date)
   *   "Fall 2026"  -> 2026-01-01
   *   "Issue 5"    -> 2001-05-01     (read as month 5 of year 2001)
   *
   * None of those return null, so nothing downstream could tell they were
   * wrong; the article simply filed itself under a date the paper never
   * published. Rejecting is the safe failure: publish:check then holds the
   * article back and logs publish_blocked_unusable_date, which is visible,
   * instead of quietly corrupting the archive.
   */
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;

  const named = NAMED_MONTH.exec(trimmed);
  const dayFirst = DAY_FIRST.exec(trimmed);
  const iso = ISO_DATE.exec(trimmed);
  const slashed = US_SLASHED.exec(trimmed);

  const monthFromName = (name: string): number | null => {
    const lower = name.toLowerCase();
    const index = MONTH_NAMES.findIndex((m) => m === lower || (lower.length >= 3 && m.startsWith(lower)));
    return index === -1 ? null : index + 1;
  };

  if (named) {
    const resolved = monthFromName(named[1]!);
    if (resolved === null) {
      console.warn(`[tech.caltech.edu] Unrecognised month in Issue property: "${issueString}"`);
      return null;
    }
    month = resolved;
    day = Number(named[2]);
    year = Number(named[3]);
  } else if (dayFirst) {
    const resolved = monthFromName(dayFirst[2]!);
    if (resolved === null) {
      console.warn(`[tech.caltech.edu] Unrecognised month in Issue property: "${issueString}"`);
      return null;
    }
    day = Number(dayFirst[1]);
    month = resolved;
    year = Number(dayFirst[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (slashed) {
    month = Number(slashed[1]);
    day = Number(slashed[2]);
    year = Number(slashed[3]);
  } else {
    console.warn(`[tech.caltech.edu] Invalid date format in Issue property: "${issueString}"`);
    return null;
  }

  const parsed = pacificMorning(year, month, day);
  if (!parsed) {
    console.warn(`[tech.caltech.edu] Not a real calendar date in Issue property: "${issueString}"`);
  }
  return parsed;
}

/**
 * Parse a website publish date from Notion's date property.
 *
 * @param dateString - ISO date string from Notion
 * @returns ISO timestamp string or null if parsing fails
 *
 * @example
 * parseWebsitePublishDate("2023-01-20")
 * // Returns: "2023-01-20T00:00:00.000Z"
 */
export function parseWebsitePublishDate(dateString: string): string | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      console.warn(`[tech.caltech.edu] Invalid date format in Website Publish Date: "${dateString}"`);
      return null;
    }

    return date.toISOString();
  } catch (error) {
    console.error(`[tech.caltech.edu] Error parsing Website Publish Date "${dateString}":`, error);
    return null;
  }
}
