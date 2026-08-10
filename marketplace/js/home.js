import { getListings, getListingsByIds } from './db.js';
import { getRecentIds } from './recently-viewed.js';
import { renderListingCard, wireLikeButtons } from './listing-card.js';
import { revealOnScroll } from './motion.js';

const grid = document.getElementById('recent-grid');
const titleEl = document.getElementById('recent-title');
const subEl = document.getElementById('recent-sub');

// Hero Buy/Sell toggle. Swaps the pitch rather than just relabelling a link,
// so the Sell side actually speaks to sellers.
const HERO_MODES = {
	buy: {
		title: 'Find your signature scent.',
		sub: "Bottles people stopped reaching for, passed on instead of poured out.",
		cta: 'Shop now',
		href: 'browse.html',
	},
	sell: {
		title: 'Move on what you never wear.',
		sub: 'List a bottle in a couple of minutes. Set a price or let it run as an auction.',
		cta: 'Start selling',
		href: 'sell.html',
	},
};

function wireModeToggle() {
	const buyBtn = document.getElementById('mode-buy');
	const sellBtn = document.getElementById('mode-sell');
	const title = document.getElementById('hero-title');
	const sub = document.getElementById('hero-sub');
	const cta = document.getElementById('hero-cta');
	if (!buyBtn || !sellBtn || !title || !sub || !cta) return;

	const apply = (mode) => {
		const m = HERO_MODES[mode];
		title.textContent = m.title;
		sub.textContent = m.sub;
		cta.textContent = m.cta;
		cta.href = m.href;
		const buying = mode === 'buy';
		buyBtn.classList.toggle('active', buying);
		sellBtn.classList.toggle('active', !buying);
		buyBtn.setAttribute('aria-selected', String(buying));
		sellBtn.setAttribute('aria-selected', String(!buying));
	};

	buyBtn.addEventListener('click', () => apply('buy'));
	sellBtn.addEventListener('click', () => apply('sell'));
}

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
wireModeToggle();
render();
