import { getListings, getListingsByIds } from './db.js';
import { getRecentIds } from './recently-viewed.js';
import { renderListingCard, wireLikeButtons } from './listing-card.js';
import { revealOnScroll } from './motion.js';

const grid = document.getElementById('recent-grid');
const titleEl = document.getElementById('recent-title');
const subEl = document.getElementById('recent-sub');

async function render() {
	if (!grid) return;

	const recentIds = getRecentIds();
	let listings = [];

	if (recentIds.length) {
		const found = await getListingsByIds(recentIds);
		const byId = new Map(found.map((l) => [l.id, l]));
		listings = recentIds.map((id) => byId.get(id)).filter((l) => l && l.status !== 'sold');
	}

	const usingFallback = !listings.length;
	if (usingFallback) {
		listings = (await getListings({})).slice(0, 8);
	}

	if (titleEl) titleEl.textContent = usingFallback ? 'Just landed' : 'Recently viewed';
	if (subEl) {
		subEl.textContent = usingFallback
			? "Nothing in your history yet, so here's what's new."
			: 'Picking up where you left off.';
	}

	if (!listings.length) {
		grid.innerHTML = `<div class="empty-state">Nothing to show yet. <a href="browse.html">Browse the collection</a>.</div>`;
		return;
	}

	grid.innerHTML = listings.map(renderListingCard).join('');
	revealOnScroll('#recent-grid .listing-card');
}

if (grid) wireLikeButtons(grid);
render();
