// Local wishlist ("Liked") and shortlist ("Bag") state. Both are prototype-only
// and stored per-browser, no Supabase table backs them yet.

const LIKED_KEY = 'fm_liked_ids';
const BAG_KEY = 'fm_bag_ids';

function readIds(key) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function writeIds(key, ids) {
	localStorage.setItem(key, JSON.stringify(ids));
	document.dispatchEvent(new CustomEvent('fm:counts-changed'));
}

function toggleId(key, id) {
	const ids = readIds(key);
	const idx = ids.indexOf(id);
	if (idx === -1) ids.push(id);
	else ids.splice(idx, 1);
	writeIds(key, ids);
	return ids.includes(id);
}

export const getLikedIds = () => readIds(LIKED_KEY);
export const isLiked = (id) => getLikedIds().includes(id);
export const toggleLiked = (id) => toggleId(LIKED_KEY, id);

export const getBagIds = () => readIds(BAG_KEY);
export const isInBag = (id) => getBagIds().includes(id);
export const toggleBag = (id) => toggleId(BAG_KEY, id);
