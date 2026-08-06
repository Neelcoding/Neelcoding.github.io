import { getCurrentUser, getOffersForSeller, respondToOffer, updateListingStatus } from './db.js';
import { revealOnScroll } from './motion.js';

const root = document.getElementById('offers-root');

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function renderSignedOut() {
	root.innerHTML = `
		<div class="card-panel" style="text-align:center;">
			<h2 style="margin-top:0;">Sign in to view offers</h2>
			<a href="account.html" class="btn btn-primary">Sign in / Create account</a>
		</div>
	`;
}

async function render() {
	const user = await getCurrentUser();
	if (!user) return renderSignedOut();

	const offers = await getOffersForSeller(user.id);

	root.innerHTML = `
		<h1 style="margin-bottom:6px;">Offers on your listings</h1>
		<p style="color:var(--ink-soft);margin:0 0 24px;">Sorted from highest to lowest. Offers aren't binding, so accepting one won't charge the buyer automatically.</p>
		${offers.length ? offers.map(offerRow).join('') : `<div class="empty-state" style="padding:40px 20px;">No offers yet.</div>`}
	`;

	offers.forEach((offer) => {
		if (offer.status !== 'pending') return;
		const acceptBtn = document.getElementById(`accept-${offer.id}`);
		const declineBtn = document.getElementById(`decline-${offer.id}`);
		acceptBtn?.addEventListener('click', async () => {
			acceptBtn.disabled = true;
			declineBtn.disabled = true;
			await respondToOffer(offer.id, 'accepted');
			if (offer.listings && offer.listings.status !== 'sold') {
				await updateListingStatus(offer.listing_id, 'sold');
			}
			render();
		});
		declineBtn?.addEventListener('click', async () => {
			acceptBtn.disabled = true;
			declineBtn.disabled = true;
			await respondToOffer(offer.id, 'declined');
			render();
		});
	});
	revealOnScroll('.offer-row', { y: 14 });
}

function offerRow(offer) {
	const listing = offer.listings;
	const buyer = offer.buyer;
	return `
		<div class="offer-row">
			<div style="min-width:0;">
				<div class="offer-amount">$${Number(offer.amount).toFixed(0)}</div>
				<div class="offer-meta">
					${listing ? `<a href="listing.html?id=${encodeURIComponent(offer.listing_id)}">${escapeHtml(listing.brand)} ${escapeHtml(listing.name)}</a> · asking $${Number(listing.price).toFixed(0)}` : 'Listing removed'}
					<br />from ${escapeHtml(buyer?.display_name || buyer?.username || 'a buyer')}
					${offer.message ? `<br />“${escapeHtml(offer.message)}”` : ''}
				</div>
			</div>
			<div class="offer-actions">
				${offer.status === 'pending' ? `
					<button class="btn btn-primary btn-sm" id="accept-${offer.id}">Accept</button>
					<button class="btn btn-outline btn-sm" id="decline-${offer.id}">Decline</button>
				` : `<span class="offer-status ${offer.status}">${offer.status}</span>`}
			</div>
		</div>
	`;
}

render();
