import { getListings, SCENT_FAMILIES, CONDITIONS } from './db.js';
import { MOCK_LISTINGS } from './mock-data.js';
import { getLikedIds, getBagIds } from './wishlist.js';
import { revealOnScroll } from './motion.js';
import { renderListingCard, wireLikeButtons } from './listing-card.js';
import { renderEmptyState } from './empty-state.js';

const grid = document.getElementById('listing-grid');
const resultsCount = document.getElementById('results-count');
const brandSelect = document.getElementById('f-brand');
const conditionSelect = document.getElementById('f-condition');
const genderWrap = document.getElementById('f-gender');
const notesWrap = document.getElementById('f-notes');
const minInput = document.getElementById('f-min');
const maxInput = document.getElementById('f-max');
const sortSelect = document.getElementById('f-sort');
const searchForm = document.getElementById('header-search-form');
const searchInput = document.getElementById('header-search-input');
const clearBtn = document.getElementById('clear-filters');

const SEASON_FAMILIES = {
	spring: ['floral', 'aromatic'],
	summer: ['citrus', 'aquatic'],
	fall: ['woody', 'spicy'],
	winter: ['oud', 'musky'],
};

const params = new URLSearchParams(location.search);
if (params.get('q')) searchInput.value = params.get('q');
const seasonParam = params.get('season');
const viewParam = params.get('view'); // 'liked' | 'bag' | null
const genderParam = params.get('gender'); // 'men' | 'women' | 'unisex'
const familyParam = params.get('family'); // comma-separated scent families
const maxParam = params.get('max'); // price ceiling
const auctionParam = params.get('auction') === '1';

function populateStaticFilters() {
	const brands = [...new Set(MOCK_LISTINGS.map((l) => l.brand))].sort();
	brands.forEach((b) => {
		const opt = document.createElement('option');
		opt.value = b;
		opt.textContent = b;
		brandSelect.appendChild(opt);
	});

	CONDITIONS.forEach((c) => {
		const opt = document.createElement('option');
		opt.value = c.value;
		opt.textContent = c.label;
		conditionSelect.appendChild(opt);
	});

	['men', 'women', 'unisex'].forEach((g) => {
		const label = document.createElement('label');
		label.className = 'filter-option';
		label.innerHTML = `<input type="radio" name="gender" value="${g}" /> <span style="text-transform:capitalize;">${g}</span>`;
		genderWrap.appendChild(label);
	});
	const anyLabel = document.createElement('label');
	anyLabel.className = 'filter-option';
	anyLabel.innerHTML = `<input type="radio" name="gender" value="" checked /> <span>Any</span>`;
	genderWrap.prepend(anyLabel);

	SCENT_FAMILIES.forEach((f) => {
		const label = document.createElement('label');
		label.className = 'filter-option';
		label.innerHTML = `<input type="checkbox" name="notes" value="${f}" /> <span style="text-transform:capitalize;">${f}</span>`;
		notesWrap.appendChild(label);
	});

	// Reflect any URL filters in the sidebar controls rather than filtering
	// invisibly, so the state is visible and "Clear all filters" still works.
	if (seasonParam && SEASON_FAMILIES[seasonParam]) {
		SEASON_FAMILIES[seasonParam].forEach((f) => checkFamily(f));
	}
	if (genderParam) {
		const radio = genderWrap.querySelector(`input[name="gender"][value="${genderParam}"]`);
		if (radio) radio.checked = true;
	}
	if (familyParam) {
		familyParam.split(',').forEach((f) => checkFamily(f.trim()));
	}
	if (maxParam && !Number.isNaN(Number(maxParam))) {
		maxInput.value = Number(maxParam);
	}
}

function checkFamily(family) {
	const box = notesWrap.querySelector(`input[name="notes"][value="${family}"]`);
	if (box) box.checked = true;
}

function currentFilters() {
	const gender = genderWrap.querySelector('input[name="gender"]:checked')?.value || '';
	const scentFamily = [...notesWrap.querySelectorAll('input[name="notes"]:checked')].map((i) => i.value);
	return {
		search: searchInput.value.trim(),
		brand: brandSelect.value,
		condition: conditionSelect.value,
		gender,
		scentFamily,
		minPrice: minInput.value ? Number(minInput.value) : null,
		maxPrice: maxInput.value ? Number(maxInput.value) : null,
		sort: sortSelect.value,
		includeSold: viewParam === 'liked' || viewParam === 'bag',
	};
}

/** True when anything is narrowing the results, so an empty grid means the
 *  filters excluded everything rather than the marketplace being empty. */
function hasActiveFilters(filters) {
	return Boolean(
		filters.search ||
		filters.brand ||
		filters.condition ||
		filters.gender ||
		filters.scentFamily.length ||
		filters.minPrice != null ||
		filters.maxPrice != null ||
		auctionParam,
	);
}

/* "Nothing matched your filters" and "nothing has ever been listed" look
   identical in an empty grid but need opposite recoveries: widen the search
   versus put the first bottle up. */
function emptyStateFor(filters) {
	if (viewParam === 'liked') {
		return renderEmptyState({
			icon: 'heart',
			title: 'Nothing saved yet',
			body: 'The heart on any listing keeps it here, so you can compare a few bottles before committing to one.',
			actions: [{ label: 'Browse everything', href: 'browse.html' }],
		});
	}
	if (viewParam === 'bag') {
		return renderEmptyState({
			icon: 'bag',
			title: 'Your bag is empty',
			body: 'Add bottles from a listing page to line them up side by side before you buy.',
			actions: [{ label: 'Browse everything', href: 'browse.html' }],
		});
	}
	if (hasActiveFilters(filters)) {
		return renderEmptyState({
			icon: auctionParam ? 'gavel' : 'search',
			title: auctionParam ? 'No auctions running' : 'Nothing matches those filters',
			body: auctionParam
				? 'Sellers can run any listing as an auction for up to seven days. None are live right now.'
				: 'Every filter narrows the results. Clearing a few should bring more back.',
			actions: [
				{ label: 'Clear filters', href: 'browse.html' },
				{ label: 'List a bottle', href: 'sell.html', variant: 'btn-outline' },
			],
		});
	}
	// Nothing listed at all. Say so plainly rather than blaming the search.
	return renderEmptyState({
		icon: 'bottle',
		title: 'Nothing listed yet',
		body: 'Vial is new, so the shelves are bare. Put a bottle up and buyers can message you, offer below asking, or bid if you run it as an auction.',
		actions: [{ label: 'List the first bottle', href: 'sell.html' }],
		feature: true,
	});
}

async function render() {
	resultsCount.textContent = 'Loading listings…';
	grid.innerHTML = '';
	try {
		const filters = currentFilters();
		let listings = await getListings(filters);

		if (viewParam === 'liked') {
			const ids = getLikedIds();
			listings = listings.filter((l) => ids.includes(l.id));
		} else if (viewParam === 'bag') {
			const ids = getBagIds();
			listings = listings.filter((l) => ids.includes(l.id));
		}
		if (auctionParam) listings = listings.filter((l) => l.is_auction);

		const label = viewParam === 'liked'
			? 'liked item'
			: viewParam === 'bag'
				? 'item in bag'
				: auctionParam
					? 'auction'
					: 'listing';
		resultsCount.textContent = `${listings.length} ${label}${listings.length === 1 ? '' : 's'}`;
		if (!listings.length) {
			grid.innerHTML = emptyStateFor(filters);
			return;
		}
		grid.innerHTML = listings.map(renderListingCard).join('');
		revealOnScroll('.listing-card');
	} catch (err) {
		resultsCount.textContent = 'Something went wrong loading listings.';
		console.error(err);
	}
}

/* On a phone the filter panel is taller than the viewport, so leaving it open
   by default buries the listings under a wall of checkboxes. The toggle only
   exists below the layout breakpoint; on desktop the panel is always open and
   the button is hidden. */
function wireFilterToggle() {
	const toggle = document.getElementById('filters-toggle');
	const panel = document.getElementById('filters');
	if (!toggle || !panel) return;
	toggle.addEventListener('click', () => {
		const open = panel.classList.toggle('is-open');
		toggle.setAttribute('aria-expanded', String(open));
	});
}

populateStaticFilters();
wireFilterToggle();
render();

[brandSelect, conditionSelect, sortSelect].forEach((el) => el.addEventListener('change', render));
genderWrap.addEventListener('change', render);
notesWrap.addEventListener('change', render);
[minInput, maxInput].forEach((el) => el.addEventListener('input', debounce(render, 350)));
searchForm.addEventListener('submit', (e) => {
	e.preventDefault();
	render();
});
clearBtn.addEventListener('click', () => {
	searchInput.value = '';
	brandSelect.value = '';
	conditionSelect.value = '';
	minInput.value = '';
	maxInput.value = '';
	sortSelect.value = 'newest';
	genderWrap.querySelector('input[value=""]').checked = true;
	notesWrap.querySelectorAll('input[name="notes"]').forEach((i) => (i.checked = false));
	render();
});

wireLikeButtons(grid, (id, liked) => {
	if (viewParam === 'liked' && !liked) render();
});

function debounce(fn, ms) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
}
