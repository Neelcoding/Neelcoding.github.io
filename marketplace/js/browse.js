import { getListings, SCENT_FAMILIES, CONDITIONS } from './db.js';
import { MOCK_LISTINGS } from './mock-data.js';

const grid = document.getElementById('listing-grid');
const resultsCount = document.getElementById('results-count');
const brandSelect = document.getElementById('f-brand');
const conditionSelect = document.getElementById('f-condition');
const genderWrap = document.getElementById('f-gender');
const notesWrap = document.getElementById('f-notes');
const minInput = document.getElementById('f-min');
const maxInput = document.getElementById('f-max');
const sortSelect = document.getElementById('f-sort');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-filters');

const params = new URLSearchParams(location.search);
if (params.get('q')) searchInput.value = params.get('q');

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
	};
}

function conditionLabel(value) {
	return CONDITIONS.find((c) => c.value === value)?.label || value;
}

function card(listing) {
	const seller = listing.profiles;
	return `
		<a class="listing-card" href="listing.html?id=${encodeURIComponent(listing.id)}">
			<div class="thumb">
				${listing.status === 'sold' ? '<span class="badge sold">Sold</span>' : ''}
				${listing.images?.[0] || '🧴'}
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
		const listings = await getListings(filters);
		resultsCount.textContent = `${listings.length} listing${listings.length === 1 ? '' : 's'}`;
		if (!listings.length) {
			grid.innerHTML = `<div class="empty-state">No fragrances match those filters yet.<br />Try widening your search.</div>`;
			return;
		}
		grid.innerHTML = listings.map(card).join('');
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

function debounce(fn, ms) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
}
