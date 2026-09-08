import { getCurrentUser, getListingsBySeller, updateListingStatus, deleteListing, getPayoutStatus, CONDITIONS } from './db.js';
import { renderThumbImage } from './icons.js';
import { revealOnScroll } from './motion.js';
import { renderEmptyState, renderSignedOut as renderSignedOutState } from './empty-state.js';

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
	root.innerHTML = renderSignedOutState({
		title: 'Your listings live here',
		body: 'Sign in to see what you have up, mark bottles sold, and track the offers and bids coming in on them.',
	});
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
		<div id="payout-warning"></div>
		${listings.length ? listings.map(listingRow).join('') : renderEmptyState({
			icon: 'bottle',
			title: 'No bottles up yet',
			body: 'Listing takes a couple of minutes. Once a bottle is live, buyers can ask about it, offer under your price, or bid against each other for it.',
			actions: [{ label: 'List your first bottle', href: 'sell.html' }],
			feature: true,
		})}
	`;

	listings.forEach((listing) => {
		document.getElementById(`toggle-${listing.id}`)?.addEventListener('click', async (e) => {
			e.target.disabled = true;
			const next = listing.status === 'sold' ? 'available' : 'sold';
			await updateListingStatus(listing.id, next);
			render();
		});

		// Deleting is irreversible and the row gives no second chance, so the
		// button asks for one: a first press turns it into the confirmation
		// rather than opening a dialog over the page.
		const del = document.getElementById(`delete-${listing.id}`);
		let armed = false;
		del?.addEventListener('click', async () => {
			if (!armed) {
				armed = true;
				del.textContent = 'Delete for good?';
				del.classList.add('is-armed');
				setTimeout(() => {
					if (!armed || !del.isConnected) return;
					armed = false;
					del.textContent = 'Delete';
					del.classList.remove('is-armed');
				}, 4000);
				return;
			}
			del.disabled = true;
			del.textContent = 'Deleting';
			try {
				await deleteListing(listing.id);
				render();
			} catch (err) {
				del.disabled = false;
				del.textContent = 'Delete';
				del.classList.remove('is-armed');
				armed = false;
				const row = del.closest('.offer-row');
				let note = row?.querySelector('.row-error');
				if (!note && row) {
					note = document.createElement('div');
					note.className = 'row-error';
					row.appendChild(note);
				}
				if (note) note.textContent = err.message || 'Could not delete this listing.';
			}
		});
	});
	revealOnScroll('.offer-row', { y: 14 });
	warnIfUnpaid(listings.length);
}

/* A listing that nobody can buy looks identical to one that nobody wants, and
   the seller has no way to tell the difference. This is the page they come back
   to, so it is where the unfinished payout setup has to surface. */
async function warnIfUnpaid(listingCount) {
	const el = document.getElementById('payout-warning');
	if (!el || !listingCount) return;
	let status;
	try {
		status = await getPayoutStatus();
	} catch {
		return; // Never block the listings themselves on a status check.
	}
	if (status.demo || status.payoutsEnabled) return;
	el.innerHTML = `
		<div class="form-msg error" style="margin-bottom:20px;">
			<strong>Your bottles can't be bought yet.</strong>
			Payout setup isn't finished, so the Buy button is hidden on your listings.
			<a href="account.html">Finish it on your account page</a> and they go live immediately.
		</div>
	`;
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
				<button class="btn btn-danger btn-sm" id="delete-${listing.id}">Delete</button>
			</div>
		</div>
	`;
}

render();
