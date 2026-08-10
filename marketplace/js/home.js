import { getListings, getListingsByIds } from './db.js';
import { getRecentIds } from './recently-viewed.js';
import { renderListingCard, wireLikeButtons } from './listing-card.js';
import { revealOnScroll } from './motion.js';
import { renderEmptyState } from './empty-state.js';

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

	// Three states, not two: your history, the newest listings, or an empty
	// marketplace. In the empty case the section header is dropped entirely
	// rather than restated, since the empty state below already says it and two
	// stacked headings saying the same thing is just noise.
	const nothingListed = !listings.length;
	const header = document.querySelector('.recent-header');
	if (header) header.hidden = nothingListed;

	if (titleEl) titleEl.textContent = usingFallback ? 'Just landed' : 'Recently viewed';
	if (subEl) {
		subEl.textContent = usingFallback
			? "Nothing in your history yet, so here's what's new."
			: 'Picking up where you left off.';
	}

	if (nothingListed) {
		grid.innerHTML = renderEmptyState({
			icon: 'bottle',
			title: 'Be the first to list',
			body: 'No bottles are up yet. Post one and buyers can message you, offer under your asking price, or bid if you run it as an auction. That is how you find out what it is worth.',
			actions: [{ label: 'List a bottle', href: 'sell.html' }],
			feature: true,
		});
		return;
	}

	grid.innerHTML = listings.map(renderListingCard).join('');
	revealOnScroll('#recent-grid .listing-card');
}

if (grid) wireLikeButtons(grid);
render();
