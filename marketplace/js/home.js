import { getListings, getListingsByIds, SCENT_FAMILIES } from './db.js';
import { getRecentIds } from './recently-viewed.js';
import { renderListingCard, wireLikeButtons } from './listing-card.js';
import { revealOnScroll, fillGauges } from './motion.js';
import { renderEmptyState } from './empty-state.js';

const grid = document.getElementById('recent-grid');
const titleEl = document.getElementById('recent-title');


/* The organ: the real 12-family taxonomy as a numbered index. A grid of
   rounded category cards is the reflex here; an index is how a shelf is
   actually labelled, and it scans faster. Every entry is a working filter. */
function renderOrgan() {
	const el = document.getElementById('organ-index');
	if (!el) return;
	el.innerHTML = SCENT_FAMILIES.map(
		(family, i) => `
		<a class="organ-row" href="browse.html?family=${encodeURIComponent(family)}">
			<span class="organ-no data">${String(i + 1).padStart(2, '0')}</span>
			<span class="organ-name">${family}</span>
			<span class="organ-rule" aria-hidden="true"></span>
		</a>`,
	).join('');
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

	// Three states, not two: your history, the newest listings, or an empty
	// marketplace. In the empty case the section header is dropped entirely
	// rather than restated, since the empty state below already says it and two
	// stacked headings saying the same thing is just noise.
	const nothingListed = !listings.length;
	const header = document.querySelector('.recent-section .section-head');
	if (header) header.hidden = nothingListed;

	// The heading alone now carries the distinction between your own history
	// and the newest listings.
	if (titleEl) titleEl.textContent = usingFallback ? 'Just landed' : 'Recently viewed';

	if (nothingListed) {
		/* A centred island in a tall void reads as "the query returned nothing".
		   Composed as a band on a rule, it reads as a designed state. The
		   taxonomy is deliberately not repeated here; the organ section below
		   already carries it. */
		grid.innerHTML = `
			<div class="cold-start">
				<div class="cold-start-copy">
					<h2>The shelves are empty</h2>
					<p>Vial is new. The first bottles here will be the ones people list
					themselves, and the first seller sets the going rate.</p>
				</div>
				<a class="btn btn-primary btn-lg" href="sell.html">List the first bottle</a>
			</div>`;
		return;
	}

	grid.innerHTML = listings.map(renderListingCard).join('');
	revealOnScroll('#recent-grid .listing-card');
	fillGauges(grid);
}

renderOrgan();
if (grid) wireLikeButtons(grid);
render();
