// Local "recently viewed" history, per-browser, no Supabase table backs it.
// Most-recent-first, capped so it doesn't grow forever.

const RECENT_KEY = 'fm_recent_listing_ids';
const MAX_RECENT = 12;

export function recordView(id) {
	if (!id) return;
	const ids = getRecentIds().filter((existing) => existing !== id);
	ids.unshift(id);
	localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

export function getRecentIds() {
	try {
		const raw = localStorage.getItem(RECENT_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}
