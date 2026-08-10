import { getCurrentUser, getOffersForSeller, getListingsBySeller, respondToOffer, updateListingStatus } from './db.js';
import { revealOnScroll } from './motion.js';
import { renderEmptyState, renderSignedOut as renderSignedOutState } from './empty-state.js';

const root = document.getElementById('offers-root');

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function renderSignedOut() {
	root.innerHTML = renderSignedOutState({
		title: 'Offers on your bottles land here',
		body: 'Sign in to see what buyers are willing to pay, sorted highest first, and accept or decline each one.',
	});
}

/* Nothing to accept yet has two causes with different fixes: no bottles listed,
   or bottles listed that nobody has bid on. Sending someone to "list a bottle"
   when they already have five is useless advice. */
async function emptyOffersState(userId) {
	const listings = await getListingsBySeller(userId);
	if (!listings.length) {
		return renderEmptyState({
			icon: 'tag',
			title: 'No offers yet',
			body: 'Offers arrive once you have something listed. Buyers name a price under your asking price, and you decide.',
			actions: [{ label: 'List a bottle', href: 'sell.html' }],
			feature: true,
		});
	}
	const live = listings.filter((l) => l.status !== 'sold').length;
	return renderEmptyState({
		icon: 'tag',
		title: 'No offers yet',
		body: `You have ${live} bottle${live === 1 ? '' : 's'} up. When a buyer offers below your asking price it appears here, highest first, and nothing is charged unless you accept.`,
		actions: [
			{ label: 'View your listings', href: 'my-listings.html' },
			{ label: 'List another', href: 'sell.html', variant: 'btn-outline' },
		],
		feature: true,
	});
}

async function render() {
	const user = await getCurrentUser();
	if (!user) return renderSignedOut();

	const offers = await getOffersForSeller(user.id);

	root.innerHTML = `
		<h1 style="margin-bottom:6px;">Offers on your listings</h1>
		<p style="color:var(--ink-soft);margin:0 0 24px;">Sorted from highest to lowest. Offers aren't binding, so accepting one won't charge the buyer automatically.</p>
		${offers.length ? offers.map(offerRow).join('') : await emptyOffersState(user.id)}
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
