import {
	getListingById,
	getCurrentUser,
	updateListingStatus,
	getOrCreateConversation,
	createOffer,
	getBids,
	placeBid,
	getAccessToken,
	CONDITIONS,
} from './db.js';
import { iconHeart, ICON_BAG, renderThumbImage, renderAvatar } from './icons.js';
import { isLiked, toggleLiked, isInBag, toggleBag } from './wishlist.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './supabase-client.js';
import { revealOnScroll } from './motion.js';
import { recordView } from './recently-viewed.js';
import { renderEmptyState } from './empty-state.js';

const root = document.getElementById('listing-root');
const params = new URLSearchParams(location.search);
const id = params.get('id');
const purchaseStatus = params.get('purchase'); // 'success' | 'cancelled' | null

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function conditionLabel(value) {
	return CONDITIONS.find((c) => c.value === value)?.label || value;
}

function openModal(html) {
	const overlay = document.createElement('div');
	overlay.className = 'modal-overlay';
	overlay.innerHTML = `<div class="modal-box">${html}</div>`;
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) overlay.remove();
	});
	document.body.appendChild(overlay);
	return overlay;
}

function closeableModal(overlay) {
	overlay.querySelector('#modal-close')?.addEventListener('click', () => overlay.remove());
	overlay.querySelector('#modal-done')?.addEventListener('click', () => overlay.remove());
}

async function render() {
	if (!id) {
		root.innerHTML = renderEmptyState({
			icon: 'broken',
			title: 'No bottle specified',
			body: 'That link is missing a listing, so there is nothing to show.',
			actions: [{ label: 'Browse bottles', href: 'browse.html' }],
			feature: true,
			heading: 'h1',
		});
		return;
	}
	const listing = await getListingById(id);
	if (!listing) {
		root.innerHTML = renderEmptyState({
			icon: 'broken',
			title: 'That bottle is gone',
			body: 'The seller removed this listing, or the link is wrong.',
			actions: [{ label: 'Browse bottles', href: 'browse.html' }],
			feature: true,
			heading: 'h1',
		});
		return;
	}
	const seller = listing.profiles || {};
	const currentUser = await getCurrentUser();
	const isOwner = currentUser && currentUser.id === listing.seller_id;
	if (!isOwner) recordView(listing.id);
	const images = listing.images?.length ? listing.images : [null];
	const bids = listing.is_auction ? await getBids(listing.id) : [];

	root.innerHTML = `
		${purchaseBanner()}
		<div class="listing-detail">
			<div>
				<div class="gallery-main" id="gallery-main">${renderImage(images[0])}</div>
				<div class="gallery-thumbs">
					${images.map((img, i) => `<div class="t ${i === 0 ? 'active' : ''}" data-img="${i}">${renderImage(img, true)}</div>`).join('')}
				</div>
			</div>
			<div>
				<div class="detail-brand">${escapeHtml(listing.brand)}</div>
				<h1 class="detail-title">${escapeHtml(listing.name)}</h1>
				<div class="detail-price">
					$${Number(listing.price).toFixed(0)}${listing.is_auction ? ' <span style="font-size:14px;color:var(--ink-soft);font-weight:500;">starting price</span>' : ''}
					${listing.status === 'sold' ? '<span class="badge sold" style="position:static;margin-left:10px;">Sold</span>' : ''}
				</div>
				${buyNowFeeNote(listing)}

				${listing.is_auction ? auctionPanel(listing, bids, currentUser) : ''}

				<div class="spec-grid">
					<div><div class="spec-label">Size</div><div class="spec-value">${listing.size_ml} ml</div></div>
					<div><div class="spec-label">Fill level</div><div class="spec-value">${listing.fill_percentage}%</div></div>
					<div><div class="spec-label">Condition</div><div class="spec-value"><span class="chip chip-condition" data-condition="${escapeHtml(listing.condition)}">${conditionLabel(listing.condition)}</span></div></div>
					<div><div class="spec-label">Box</div><div class="spec-value">${escapeHtml(boxLabel(listing.box_included))}</div></div>
					<div><div class="spec-label">Batch code</div><div class="spec-value">${escapeHtml(listing.batch_code || 'N/A')}</div></div>
					<div><div class="spec-label">Purchased</div><div class="spec-value">${listing.purchase_year || 'N/A'}</div></div>
					<div><div class="spec-label">Gender</div><div class="spec-value" style="text-transform:capitalize;">${escapeHtml(listing.gender || 'N/A')}</div></div>
					<div><div class="spec-label">Listed</div><div class="spec-value">${new Date(listing.created_at).toLocaleDateString()}</div></div>
				</div>

				<div class="notes-tags">
					${(listing.scent_family || []).map((n) => `<span class="chip">${escapeHtml(n)}</span>`).join('')}
				</div>

				<p class="detail-description">${escapeHtml(listing.description || '')}</p>

				<div class="action-row" id="action-row"></div>

				<a class="seller-card" href="profile.html?id=${encodeURIComponent(listing.seller_id)}">
					${renderAvatar(seller, 46)}
					<div>
						<div class="seller-name">${escapeHtml(seller.display_name || seller.username || 'Seller')}</div>
						<div class="seller-loc">${escapeHtml(seller.location || 'Location not set')}</div>
					</div>
				</a>
			</div>
		</div>
	`;

	document.querySelectorAll('.gallery-thumbs .t').forEach((el) => {
		el.addEventListener('click', () => {
			document.querySelectorAll('.gallery-thumbs .t').forEach((t) => t.classList.remove('active'));
			el.classList.add('active');
			document.getElementById('gallery-main').innerHTML = renderImage(images[Number(el.dataset.img)]);
		});
	});

	wireActionRow(listing, seller, currentUser, isOwner, bids);
	wireAuctionPanel(listing, currentUser, isOwner, bids);
	revealOnScroll('.listing-detail > *', { y: 18 });
}

function wireActionRow(listing, seller, currentUser, isOwner, bids) {
	const actionRow = document.getElementById('action-row');
	if (isOwner) {
		const ended = listing.is_auction && listing.auction_ends_at && new Date() > new Date(listing.auction_ends_at);
		const topBid = bids[0];
		actionRow.innerHTML = `
			<button class="btn btn-outline" id="toggle-sold">${listing.status === 'sold' ? 'Mark as available' : 'Mark as sold'}</button>
			${ended && topBid && listing.status !== 'sold' ? `<button class="btn btn-primary" id="award-auction">Sell to highest bidder ($${Number(topBid.amount).toFixed(0)})</button>` : ''}
		`;
		document.getElementById('toggle-sold').addEventListener('click', async (e) => {
			const next = listing.status === 'sold' ? 'available' : 'sold';
			e.target.disabled = true;
			await updateListingStatus(listing.id, next);
			render();
		});
		document.getElementById('award-auction')?.addEventListener('click', async (e) => {
			e.target.disabled = true;
			await updateListingStatus(listing.id, 'sold');
			await getOrCreateConversation({ listingId: listing.id, sellerId: listing.seller_id, buyerId: topBid.bidder_id });
			render();
		});
		return;
	}

	const liked = isLiked(listing.id);
	const inBag = isInBag(listing.id);
	const canTransact = listing.status !== 'sold' && !listing.is_auction;
	actionRow.innerHTML = `
		${canTransact ? `
			${isSupabaseConfigured && sellerCanBePaid(listing) ? '<button class="btn btn-primary" id="btn-buy">Buy now</button>' : ''}
			<button class="btn ${isSupabaseConfigured && sellerCanBePaid(listing) ? 'btn-outline' : 'btn-primary'}" id="btn-offer">Make an offer</button>
			<button class="btn btn-outline" id="btn-bag">${ICON_BAG} ${inBag ? 'Remove from bag' : 'Add to bag'}</button>
		` : ''}
		${listing.status !== 'sold' ? '<button class="btn btn-outline" id="btn-contact">Contact seller</button>' : ''}
		<button class="btn btn-outline" id="btn-like">${iconHeart(liked)} ${liked ? 'Liked' : 'Like'}</button>
	`;

	if (canTransact) {
		document.getElementById('btn-offer').addEventListener('click', () => showOfferModal(listing, seller, currentUser));
		document.getElementById('btn-bag').addEventListener('click', (e) => {
			const nowInBag = toggleBag(listing.id);
			e.currentTarget.innerHTML = `${ICON_BAG} ${nowInBag ? 'Remove from bag' : 'Add to bag'}`;
		});
		const buyBtn = document.getElementById('btn-buy');
		if (buyBtn) buyBtn.addEventListener('click', () => startCheckout(listing, buyBtn));
	}
	document.getElementById('btn-contact')?.addEventListener('click', () => contactSeller(listing, seller, currentUser));
	document.getElementById('btn-like').addEventListener('click', (e) => {
		const nowLiked = toggleLiked(listing.id);
		e.currentTarget.innerHTML = `${iconHeart(nowLiked)} ${nowLiked ? 'Liked' : 'Like'}`;
	});
}

function auctionPanel(listing, bids, currentUser) {
	const topBid = bids[0];
	const currentAmount = topBid ? Number(topBid.amount) : Number(listing.price);
	const ends = listing.auction_ends_at ? new Date(listing.auction_ends_at) : null;
	const ended = !ends || new Date() > ends;
	const isOwner = currentUser && currentUser.id === listing.seller_id;

	return `
		<div class="auction-panel">
			<div class="auction-badge">Auction</div>
			<div class="auction-current">$${currentAmount.toFixed(0)} <span style="font-size:13px;font-weight:500;color:var(--ink-soft);">${topBid ? `current bid (${bids.length} bid${bids.length === 1 ? '' : 's'})` : 'no bids yet'}</span></div>
			<div class="auction-sub" id="auction-countdown" data-ends="${ends ? ends.toISOString() : ''}">${ended ? 'Auction ended' : ''}</div>
			${!ended && !isOwner && listing.status !== 'sold' ? `
				<div class="bid-row">
					<input type="number" id="bid-amount" min="${currentAmount + 1}" step="1" placeholder="$${(currentAmount + 1).toFixed(0)} or more" />
					<button class="btn btn-primary" id="btn-bid">Place bid</button>
				</div>
			` : ''}
			${bids.length ? `
				<div class="bid-history">
					${bids.slice(0, 5).map((b) => `<div class="bid-history-row"><span>${escapeHtml(b.bidder?.display_name || b.bidder?.username || 'Bidder')}</span><span>$${Number(b.amount).toFixed(0)}</span></div>`).join('')}
				</div>
			` : ''}
		</div>
	`;
}

function wireAuctionPanel(listing, currentUser, isOwner, bids) {
	const countdownEl = document.getElementById('auction-countdown');
	if (countdownEl && countdownEl.dataset.ends) {
		const ends = new Date(countdownEl.dataset.ends);
		const tick = () => {
			const diff = ends - new Date();
			if (diff <= 0) {
				countdownEl.textContent = 'Auction ended';
				return;
			}
			const days = Math.floor(diff / 86400000);
			const hours = Math.floor((diff % 86400000) / 3600000);
			const mins = Math.floor((diff % 3600000) / 60000);
			countdownEl.textContent = `Ends in ${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m`;
		};
		tick();
		clearInterval(window.__auctionTimer);
		window.__auctionTimer = setInterval(tick, 30000);
	}

	const bidBtn = document.getElementById('btn-bid');
	if (bidBtn) {
		bidBtn.addEventListener('click', async () => {
			if (!currentUser) {
				location.href = 'account.html';
				return;
			}
			const input = document.getElementById('bid-amount');
			const amount = Number(input.value);
			if (!amount || amount <= 0) return;
			bidBtn.disabled = true;
			try {
				await placeBid({ listingId: listing.id, bidderId: currentUser.id, amount });
				render();
			} catch (err) {
				bidBtn.disabled = false;
				openModal(`
					<span class="modal-close-x" id="modal-close">&times;</span>
					<h3>Couldn't place bid</h3>
					<p class="sub">${escapeHtml(err.message || 'Something went wrong.')}</p>
					<div class="modal-actions"><button class="btn btn-outline btn-block" id="modal-done">Close</button></div>
				`);
				closeableModal(document.querySelector('.modal-overlay'));
			}
		});
	}
}

function renderImage(img) {
	return renderThumbImage(img);
}

function purchaseBanner() {
	if (purchaseStatus === 'success') {
		return `<div class="form-msg success" style="margin-bottom:20px;">Payment received, thank you! The listing will show as sold once it's confirmed (this can take a few seconds).</div>`;
	}
	if (purchaseStatus === 'cancelled') {
		return `<div class="form-msg error" style="margin-bottom:20px;">Checkout was cancelled, you weren't charged.</div>`;
	}
	return '';
}

async function startCheckout(listing, button) {
	button.disabled = true;
	button.textContent = 'Redirecting to checkout…';
	try {
		// Send the buyer's own token when we have one, so the order is recorded
		// against their account rather than just an email off the card.
		const token = (await getAccessToken()) || SUPABASE_ANON_KEY;
		const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				apikey: SUPABASE_ANON_KEY,
			},
			body: JSON.stringify({ listingId: listing.id, origin: location.href.replace(/\/listing\.html.*$/, '') }),
		});
		const data = await res.json();
		if (!res.ok || !data.url) throw new Error(data.error || 'Checkout is not set up yet.');
		location.href = data.url;
	} catch (err) {
		button.disabled = false;
		button.textContent = 'Buy now';
		const overlay = openModal(`
			<span class="modal-close-x" id="modal-close">&times;</span>
			<h3>Couldn't start checkout</h3>
			<p class="sub">${escapeHtml(err.message || 'Something went wrong.')}</p>
			<div class="modal-actions"><button class="btn btn-outline btn-block" id="modal-done">Close</button></div>
		`);
		closeableModal(overlay);
	}
}

/* A seller who hasn't finished Stripe onboarding has no account for the money
   to land in. Checkout refuses these server-side either way; hiding the button
   means a buyer meets that fact before entering a card, not after. */
function sellerCanBePaid(listing) {
	return !!listing.profiles?.stripe_payouts_enabled;
}

function buyNowFeeNote(listing) {
	const live = isSupabaseConfigured && !listing.is_auction && listing.status !== 'sold';
	if (!live) return '';
	if (!sellerCanBePaid(listing)) {
		return `<div class="hint" style="margin:-10px 0 20px;">This seller hasn't finished setting up payouts, so instant checkout is off. You can still make an offer or message them.</div>`;
	}
	const fee = Number(listing.price) * 0.05;
	const total = Number(listing.price) + fee;
	return `<div class="hint" style="margin:-10px 0 20px;">+ 5% processing fee ($${fee.toFixed(2)}) at checkout, $${total.toFixed(2)} total</div>`;
}

function boxLabel(value) {
	if (value === 'yes') return 'Included';
	if (value === 'damaged') return 'Included (damaged)';
	return 'Not included';
}

function showOfferModal(listing, seller, currentUser) {
	if (!currentUser) {
		location.href = 'account.html';
		return;
	}
	const overlay = openModal(`
		<span class="modal-close-x" id="modal-close">&times;</span>
		<h3>Make an offer</h3>
		<p class="sub">to ${escapeHtml(seller.display_name || seller.username || 'the seller')} for ${escapeHtml(listing.brand)} ${escapeHtml(listing.name)}. Must be below $${Number(listing.price).toFixed(0)}</p>
		<div id="offer-modal-msg"></div>
		<div class="form-row">
			<label>Your offer ($)</label>
			<input type="number" id="offer-amount" placeholder="${listing.price}" min="0" max="${listing.price - 1}" />
		</div>
		<div class="form-row">
			<label>Message (optional)</label>
			<textarea id="offer-message" placeholder="Hi! Would you take..."></textarea>
		</div>
		<div class="modal-actions">
			<button class="btn btn-primary btn-block" id="offer-send">Send offer</button>
		</div>
	`);
	overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
	overlay.querySelector('#offer-send').addEventListener('click', async (e) => {
		const amount = Number(overlay.querySelector('#offer-amount').value);
		const message = overlay.querySelector('#offer-message').value.trim();
		const msgEl = overlay.querySelector('#offer-modal-msg');
		if (!amount || amount <= 0) {
			msgEl.innerHTML = `<div class="form-msg error">Enter an offer amount.</div>`;
			return;
		}
		if (amount >= Number(listing.price)) {
			msgEl.innerHTML = `<div class="form-msg error">Your offer must be lower than the asking price ($${Number(listing.price).toFixed(0)}).</div>`;
			return;
		}
		e.target.disabled = true;
		try {
			await createOffer({ listingId: listing.id, sellerId: listing.seller_id, buyerId: currentUser.id, amount, message });
			overlay.querySelector('.modal-box').innerHTML = `
				<h3>Offer sent</h3>
				<p class="sub">The seller will see your $${amount.toFixed(0)} offer and can accept or decline it. This isn't binding, so no payment was taken.</p>
				<div class="modal-actions"><button class="btn btn-outline btn-block" id="modal-done">Close</button></div>
			`;
			overlay.querySelector('#modal-done').addEventListener('click', () => overlay.remove());
		} catch (err) {
			e.target.disabled = false;
			msgEl.innerHTML = `<div class="form-msg error">${escapeHtml(err.message || 'Could not send offer.')}</div>`;
		}
	});
}

async function contactSeller(listing, seller, currentUser) {
	if (!currentUser) {
		location.href = 'account.html';
		return;
	}
	const convo = await getOrCreateConversation({ listingId: listing.id, sellerId: listing.seller_id, buyerId: currentUser.id });
	location.href = `messages.html?id=${encodeURIComponent(convo.id)}`;
}

render();
