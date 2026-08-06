import { getCurrentUser, getListingsBySeller, updateListingStatus, CONDITIONS } from './db.js';
import { renderThumbImage } from './icons.js';
import { revealOnScroll } from './motion.js';

const root = document.getElementById('my-listings-root');

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function conditionLabel(value) {
	return CONDITIONS.find((c) => c.value === value)?.label || value;
}

function renderSignedOut() {
	root.innerHTML = `
		<div class="card-panel" style="text-align:center;">
			<h2 style="margin-top:0;">Sign in to see your listings</h2>
			<a href="account.html" class="btn btn-primary">Sign in / Create account</a>
		</div>
	`;
}

async function render() {
	const user = await getCurrentUser();
	if (!user) return renderSignedOut();

	const listings = await getListingsBySeller(user.id);

	root.innerHTML = `
		<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
			<h1 style="margin:0;">My listings</h1>
			<div style="display:flex;gap:8px;">
				<a href="offers.html" class="btn btn-outline btn-sm">Offers received</a>
				<a href="sell.html" class="btn btn-gold btn-sm">+ New listing</a>
			</div>
		</div>
		<p style="color:var(--ink-soft);margin:0 0 24px;">Everything you've listed, in one place.</p>
		${listings.length ? listings.map(listingRow).join('') : `<div class="empty-state" style="padding:40px 20px;">You haven't listed anything yet.</div>`}
	`;

	listings.forEach((listing) => {
		document.getElementById(`toggle-${listing.id}`)?.addEventListener('click', async (e) => {
			e.target.disabled = true;
			const next = listing.status === 'sold' ? 'available' : 'sold';
			await updateListingStatus(listing.id, next);
			render();
		});
	});
	revealOnScroll('.offer-row', { y: 14 });
}

function listingRow(listing) {
	return `
		<div class="offer-row">
			<a href="listing.html?id=${encodeURIComponent(listing.id)}" style="display:flex;align-items:center;gap:14px;min-width:0;flex:1;">
				<div class="thumb" style="width:56px;height:56px;flex-shrink:0;border-radius:8px;color:var(--ink-soft);">${renderThumbImage(listing.images?.[0])}</div>
				<div style="min-width:0;">
					<div style="font-weight:600;">${escapeHtml(listing.brand)} ${escapeHtml(listing.name)}</div>
					<div class="offer-meta">$${Number(listing.price).toFixed(0)} · ${conditionLabel(listing.condition)}${listing.is_auction ? ' · Auction' : ''}</div>
				</div>
			</a>
			<div class="offer-actions">
				<span class="offer-status ${listing.status === 'sold' ? 'declined' : 'accepted'}">${listing.status === 'sold' ? 'Sold' : 'Available'}</span>
				<button class="btn btn-outline btn-sm" id="toggle-${listing.id}">${listing.status === 'sold' ? 'Mark available' : 'Mark sold'}</button>
			</div>
		</div>
	`;
}

render();
