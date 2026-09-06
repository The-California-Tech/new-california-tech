import { compareStringDesc, getPacificDateKey, type SortablePostLike } from '$lib/utils/post-sorting';

export function parsePositiveInt(value: string | null, fallback: number): number {
	if (!value) return fallback;

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return parsed;
}

/**
 * @deprecated Superseded by `list_homepage_posts` in Postgres, which applies the
 * same issue-boundary rule server-side without fetching the whole table.
 * See supabase/schemas/20_tech_feed.sql and
 * $lib/utils/feed-query.ts. Unused as of 2026-08-22 -- safe to delete once the
 * SQL path is confirmed in production.
 */
export function getIssueBoundedEndIndex<T extends SortablePostLike>(posts: T[], targetCount: number): number {
	if (posts.length === 0 || targetCount <= 0) {
		return 0;
	}

	if (targetCount >= posts.length) {
		return posts.length;
	}

	let boundedEnd = targetCount;
	const boundaryDate = getPacificDateKey(posts[targetCount - 1]?.published);

	if (!boundaryDate) {
		return boundedEnd;
	}

	while (boundedEnd < posts.length) {
		const nextDate = getPacificDateKey(posts[boundedEnd]?.published);
		if (nextDate !== boundaryDate) {
			break;
		}

		boundedEnd += 1;
	}

	return boundedEnd;
}

/**
 * @deprecated Only existed to feed findNearestIssueDate. Unused as of 2026-08-22.
 */
export function getDistinctIssueDates<T extends SortablePostLike>(posts: T[]): string[] {
	const dates = new Set<string>();
	for (const post of posts) {
		const dateKey = getPacificDateKey(post.published);
		if (dateKey) {
			dates.add(dateKey);
		}
	}

	return Array.from(dates).sort(compareStringDesc);
}

/**
 * @deprecated Superseded by the `nearest_issue_date(date)` Postgres function,
 * which has identical semantics (smallest absolute distance either direction,
 * ties toward the newer issue) without loading every page. Unused as of
 * 2026-08-22.
 */
export function findNearestIssueDate(targetDate: string, availableDates: string[]): string | null {
	if (!targetDate || availableDates.length === 0) {
		return null;
	}

	if (availableDates.includes(targetDate)) {
		return targetDate;
	}

	const targetTime = new Date(`${targetDate}T00:00:00-08:00`).getTime();
	if (Number.isNaN(targetTime)) {
		return availableDates[0] ?? null;
	}

	let nearest = availableDates[0]!;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (const date of availableDates) {
		const time = new Date(`${date}T00:00:00-08:00`).getTime();
		if (Number.isNaN(time)) continue;

		const distance = Math.abs(time - targetTime);
		if (distance < nearestDistance) {
			nearest = date;
			nearestDistance = distance;
		}
	}

	return nearest;
}

/**
 * @deprecated Replaced by the `p_before_date` argument to `list_homepage_posts`.
 * Unused as of 2026-08-22.
 */
export function filterPostsFromIssueDate<T extends SortablePostLike>(posts: T[], issueDate: string): T[] {
	if (!issueDate) {
		return posts;
	}

	return posts.filter((post) => {
		const dateKey = getPacificDateKey(post.published);
		return dateKey !== '' && dateKey <= issueDate;
	});
}
