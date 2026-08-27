// Orders: the record of a sale after the money has moved.
//
// Two sides of the same table. As a buyer you want to know whether the thing
// you paid for has been sent; as a seller you want the address and somewhere to
// put a tracking number. Both live here so there is one answer to "what
// happened to that bottle" rather than a Stripe receipt and a guess.

import {
	getCurrentUser,
	getOrdersForBuyer,
	getOrdersForSeller,
	getOrCreateConversation,
	markOrderShipped,
	markOrderDelivered,
	requestOrderRefund,
} from './db.js';
import { renderThumbImage } from './icons.js';
import { revealOnScroll } from './motion.js';
import { renderEmptyState, renderSignedOut as renderSignedOutState } from './empty-state.js';

const root = document.getElementById('orders-root');
const params = new URLSearchParams(location.search);

let activeTab = params.get('tab') === 'sales' ? 'sales' : 'purchases';

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function money(cents) {
	return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

const STATUS_LABELS = {
	paid: 'Paid',
	shipped: 'Shipped',
	delivered: 'Delivered',
	refund_requested: 'Problem reported',
	refunded: 'Refunded',
	cancelled: 'Cancelled',
};

function renderSignedOut() {
	root.innerHTML = renderSignedOutState({
		title: 'Your orders live here',
		body: 'Sign in to see what you have bought, what you have sold, and where each bottle is in the handover.',
	});
}

function purchaseBanner() {
	if (params.get('purchase') !== 'success') return '';
	return `<div class="form-msg success" style="margin-bottom:20px;">Payment received. Your order is below, and the seller has the shipping address you entered at checkout.</div>`;
}

async function render() {
	const user = await getCurrentUser();
	if (!user) return renderSignedOut();

	const [purchases, sales] = await Promise.all([
		getOrdersForBuyer(user.id).catch(() => []),
		getOrdersForSeller(user.id).catch(() => []),
	]);

	// Land people on the side they actually have something on. A seller with no
	// purchases should not open this page onto an empty tab.
	if (!params.get('tab') && !purchases.length && sales.length) activeTab = 'sales';

	const orders = activeTab === 'sales' ? sales : purchases;

	root.innerHTML = `
		<h1 style="margin-bottom:6px;">Orders</h1>
		<p style="color:var(--ink-soft);margin:0 0 24px;">Everything that has changed hands, on both sides.</p>
		${purchaseBanner()}
		<div class="order-tabs">
			<button data-tab="purchases" class="${activeTab === 'purchases' ? 'active' : ''}">Bought${purchases.length ? ` (${purchases.length})` : ''}</button>
			<button data-tab="sales" class="${activeTab === 'sales' ? 'active' : ''}">Sold${sales.length ? ` (${sales.length})` : ''}</button>
		</div>
		<div id="order-list">
			${orders.length ? orders.map((o) => orderRow(o, activeTab)).join('') : emptyFor(activeTab)}
		</div>
	`;

	root.querySelectorAll('.order-tabs button').forEach((btn) => {
		btn.addEventListener('click', () => {
			activeTab = btn.dataset.tab;
			render();
		});
	});

	orders.forEach((order) => wireOrder(order, user));
	revealOnScroll('.offer-row', { y: 14 });
}

function emptyFor(tab) {
	if (tab === 'sales') {
		return renderEmptyState({
			icon: 'tag',
			title: 'Nothing sold yet',
			body: 'When someone buys one of your bottles, the order appears here with their shipping address and somewhere to add a tracking number.',
			actions: [{ label: 'View your listings', href: 'my-listings.html' }],
			feature: true,
		});
	}
	return renderEmptyState({
		icon: 'bottle',
		title: 'Nothing bought yet',
		body: 'Bottles you buy show up here, so you can follow the handover from paid to shipped to delivered.',
		actions: [{ label: 'Browse fragrances', href: 'browse.html' }],
		feature: true,
	});
}

function orderRow(order, tab) {
	const listing = order.listings;
	const isSeller = tab === 'sales';
	const other = isSeller ? order.buyer : order.seller;
	const otherName = other?.display_name || other?.username || (isSeller ? 'a buyer' : 'the seller');

	return `
		<div class="offer-row" id="order-${order.id}" style="flex-direction:column;align-items:stretch;">
			<div style="display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap;">
				<a href="listing.html?id=${encodeURIComponent(order.listing_id)}" style="display:flex;align-items:center;gap:14px;min-width:0;flex:1;">
					<div class="thumb" style="width:56px;height:56px;flex-shrink:0;border-radius:8px;color:var(--ink-soft);">${renderThumbImage(listing?.images?.[0])}</div>
					<div style="min-width:0;">
						<div style="font-weight:600;">${listing ? `${escapeHtml(listing.brand)} ${escapeHtml(listing.name)}` : 'Listing removed'}</div>
						<div class="offer-meta">
							${money(isSeller ? order.item_cents : order.total_cents)}
							${isSeller ? ` after the ${money(order.fee_cents)} fee` : ` including the ${money(order.fee_cents)} fee`}
							· ${isSeller ? 'to' : 'from'} ${escapeHtml(otherName)}
							· ${new Date(order.created_at).toLocaleDateString()}
						</div>
					</div>
				</a>
				<span class="offer-status ${order.status}">${STATUS_LABELS[order.status] || order.status}</span>
			</div>

			${isSeller ? sellerBlock(order) : buyerBlock(order)}
		</div>
	`;
}

function shippingAddress(order) {
	const lines = [
		order.ship_name,
		order.ship_line1,
		order.ship_line2,
		[order.ship_city, order.ship_state, order.ship_postal_code].filter(Boolean).join(', '),
		order.ship_country,
	].filter(Boolean);
	if (!lines.length) return '';
	return `<p class="order-address">${lines.map(escapeHtml).join('\n')}</p>`;
}

function trackingLine(order) {
	if (!order.tracking_number && !order.tracking_carrier) return '';
	return `<p class="order-address">${escapeHtml([order.tracking_carrier, order.tracking_number].filter(Boolean).join(' '))}</p>`;
}

function sellerBlock(order) {
	if (order.status === 'refunded' || order.status === 'cancelled') return '';

	// The address is only useful while there is still something to post, and it
	// is somebody's home, so it stops being printed once the bottle has landed.
	const stillShipping = order.status === 'paid' || order.status === 'refund_requested';

	return `
		${stillShipping ? shippingAddress(order) : ''}
		${order.refund_reason ? `<p class="order-address"><strong>Buyer reported a problem:</strong>\n${escapeHtml(order.refund_reason)}</p>` : ''}
		${trackingLine(order)}
		${stillShipping ? `
			<form class="order-ship-form" id="ship-form-${order.id}">
				<input type="text" id="carrier-${order.id}" placeholder="Carrier (USPS, UPS…)" aria-label="Carrier" />
				<input type="text" id="tracking-${order.id}" placeholder="Tracking number" aria-label="Tracking number" />
				<button class="btn btn-primary btn-sm" type="submit">Mark shipped</button>
			</form>
			<p class="hint" style="margin-top:8px;">Fragrance is a flammable liquid, so it has to go ground shipping and can't be flown.</p>
		` : ''}
	`;
}

function buyerBlock(order) {
	const canReport = ['paid', 'shipped', 'delivered'].includes(order.status);
	return `
		${trackingLine(order)}
		${order.status === 'refund_requested' ? `<p class="hint" style="margin-top:12px;">You reported a problem with this order. Message the seller to sort it out; if it can't be resolved, the payment can be refunded through Stripe.</p>` : ''}
		<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
			<button class="btn btn-outline btn-sm" id="message-${order.id}">Message seller</button>
			${order.status === 'shipped' ? `<button class="btn btn-primary btn-sm" id="delivered-${order.id}">Mark as delivered</button>` : ''}
			${canReport ? `<button class="btn btn-outline btn-sm" id="problem-${order.id}">Report a problem</button>` : ''}
		</div>
		${canReport ? `
			<div id="problem-form-${order.id}" hidden>
				<form class="order-ship-form">
					<input type="text" id="reason-${order.id}" placeholder="What went wrong?" aria-label="What went wrong" />
					<button class="btn btn-primary btn-sm" type="submit">Send report</button>
				</form>
				<p class="hint" style="margin-top:8px;">This flags the order and tells the seller. It doesn't refund you automatically; refunds are issued by hand for now.</p>
			</div>
		` : ''}
	`;
}

function wireOrder(order, user) {
	const shipForm = document.getElementById(`ship-form-${order.id}`);
	shipForm?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const btn = shipForm.querySelector('button');
		btn.disabled = true;
		btn.textContent = 'Saving…';
		try {
			await markOrderShipped(
				order.id,
				document.getElementById(`carrier-${order.id}`).value.trim(),
				document.getElementById(`tracking-${order.id}`).value.trim(),
			);
			render();
		} catch (err) {
			btn.disabled = false;
			btn.textContent = 'Mark shipped';
			alert(err.message);
		}
	});

	document.getElementById(`delivered-${order.id}`)?.addEventListener('click', async (e) => {
		e.currentTarget.disabled = true;
		try {
			await markOrderDelivered(order.id);
		} catch (err) {
			alert(err.message);
		}
		render();
	});

	document.getElementById(`problem-${order.id}`)?.addEventListener('click', () => {
		const panel = document.getElementById(`problem-form-${order.id}`);
		panel.hidden = !panel.hidden;
		if (!panel.hidden) document.getElementById(`reason-${order.id}`).focus();
	});

	document.getElementById(`problem-form-${order.id}`)?.querySelector('form')?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const btn = e.currentTarget.querySelector('button');
		btn.disabled = true;
		btn.textContent = 'Sending…';
		try {
			await requestOrderRefund(order.id, document.getElementById(`reason-${order.id}`).value.trim());
			render();
		} catch (err) {
			btn.disabled = false;
			btn.textContent = 'Send report';
			alert(err.message);
		}
	});

	// The refund path is a conversation before it is a transaction, so this
	// opens the same thread the rest of the site uses rather than a support form
	// that goes somewhere nobody reads.
	document.getElementById(`message-${order.id}`)?.addEventListener('click', async (e) => {
		e.currentTarget.disabled = true;
		try {
			await getOrCreateConversation({
				listingId: order.listing_id,
				sellerId: order.seller_id,
				buyerId: user.id,
			});
			location.href = 'messages.html';
		} catch (err) {
			e.currentTarget.disabled = false;
			alert(err.message);
		}
	});
}

render();
