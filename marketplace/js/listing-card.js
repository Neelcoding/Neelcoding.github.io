// Shared listing card markup + like-button wiring, used by both the browse
// grid and the homepage's recently-viewed strip so the two don't drift.
import { CONDITIONS } from './db.js';
import { iconHeart, renderThumbImage } from './icons.js';
import { isLiked, toggleLiked } from './wishlist.js';

export function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function conditionLabel(value) {
	return CONDITIONS.find((c) => c.value === value)?.label || value;
}

export function renderListingCard(listing) {
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

export function wireLikeButtons(container, onToggle) {
	container.addEventListener('click', (e) => {
		const btn = e.target.closest('.like-btn');
		if (!btn) return;
		e.preventDefault();
		e.stopPropagation();
		const liked = toggleLiked(btn.dataset.id);
		btn.classList.toggle('active', liked);
		btn.innerHTML = iconHeart(liked);
		btn.setAttribute('aria-label', liked ? 'Remove from liked' : 'Add to liked');
		onToggle?.(btn.dataset.id, liked);
	});
}
