import { getListings, SCENT_FAMILIES, CONDITIONS } from './db.js';
import { MOCK_LISTINGS } from './mock-data.js';
import { iconHeart, renderThumbImage } from './icons.js';
import { isLiked, toggleLiked, getLikedIds, getBagIds } from './wishlist.js';
import { revealOnScroll } from './motion.js';

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

	if (seasonParam && SEASON_FAMILIES[seasonParam]) {
		SEASON_FAMILIES[seasonParam].forEach((f) => {
			const box = notesWrap.querySelector(`input[name="notes"][value="${f}"]`);
			if (box) box.checked = true;
		});
	}
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

function conditionLabel(value) {
	return CONDITIONS.find((c) => c.value === value)?.label || value;
}

function card(listing) {
	const liked = isLiked(listing.id);
	return `
		<div class="listing-card">
			<a class="card-link" href="listing.html?id=${encodeURIComponent(listing.id)}">
				<div class="thumb">
					${listing.status === 'sold' ? '<span class="badge sold">Sold</span>' : listing.is_auction ? '<span class="badge">Auction</span>' : ''}
					${renderThumbImage(listing.images?.[0])}
				</div>
				<div class="info">
					<div class="brand">${escapeHtml(listing.brand)}</div>
					<div class="name">${escapeHtml(listing.name)}</div>
					<div class="meta">
						<span class="chip">${listing.size_ml}ml</span>
						<span class="chip">${listing.fill_percentage}% full</span>
						<span class="chip">${conditionLabel(listing.condition)}</span>
					</div>
					<div class="price">$${Number(listing.price).toFixed(0)}</div>
				</div>
			</a>
			<button class="like-btn ${liked ? 'active' : ''}" data-id="${listing.id}" aria-label="${liked ? 'Remove from liked' : 'Add to liked'}">${iconHeart(liked)}</button>
		</div>
	`;
}

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
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

		const label = viewParam === 'liked' ? 'liked item' : viewParam === 'bag' ? 'item in bag' : 'listing';
		resultsCount.textContent = `${listings.length} ${label}${listings.length === 1 ? '' : 's'}`;
		if (!listings.length) {
			const emptyMsg = viewParam === 'liked'
				? 'Nothing liked yet.<br />Tap the heart on any listing to save it here.'
				: viewParam === 'bag'
					? 'Your bag is empty.<br />Add items from a listing page.'
					: 'No fragrances match those filters yet.<br />Try widening your search.';
			grid.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
			return;
		}
		grid.innerHTML = listings.map(card).join('');
		revealOnScroll('.listing-card');
	} catch (err) {
		resultsCount.textContent = 'Something went wrong loading listings.';
		console.error(err);
	}
}

populateStaticFilters();
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

grid.addEventListener('click', (e) => {
	const btn = e.target.closest('.like-btn');
	if (!btn) return;
	e.preventDefault();
	e.stopPropagation();
	const liked = toggleLiked(btn.dataset.id);
	btn.classList.toggle('active', liked);
	btn.innerHTML = iconHeart(liked);
	btn.setAttribute('aria-label', liked ? 'Remove from liked' : 'Add to liked');
	if (viewParam === 'liked' && !liked) render();
});

function debounce(fn, ms) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
}
