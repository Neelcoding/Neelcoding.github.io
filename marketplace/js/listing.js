import { getListingById, getCurrentUser, updateListingStatus, CONDITIONS } from './db.js';

const root = document.getElementById('listing-root');
const params = new URLSearchParams(location.search);
const id = params.get('id');

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function conditionLabel(value) {
	return CONDITIONS.find((c) => c.value === value)?.label || value;
}

function initials(name) {
	return (name || '?').trim().slice(0, 1).toUpperCase();
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

async function render() {
	if (!id) {
		root.innerHTML = `<div class="empty-state">No listing specified.</div>`;
		return;
	}
	const listing = await getListingById(id);
	if (!listing) {
		root.innerHTML = `<div class="empty-state">This listing doesn't exist or was removed. <a href="index.html">Back to browsing.</a></div>`;
		return;
	}
	const seller = listing.profiles || {};
	const currentUser = await getCurrentUser();
	const isOwner = currentUser && currentUser.id === listing.seller_id;
	const images = listing.images?.length ? listing.images : ['🧴'];

	root.innerHTML = `
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
					$${Number(listing.price).toFixed(0)}
					${listing.status === 'sold' ? '<span class="badge sold" style="position:static;margin-left:10px;">Sold</span>' : ''}
				</div>

				<div class="spec-grid">
					<div><div class="spec-label">Size</div><div class="spec-value">${listing.size_ml} ml</div></div>
					<div><div class="spec-label">Fill level</div><div class="spec-value">${listing.fill_percentage}%</div></div>
					<div><div class="spec-label">Condition</div><div class="spec-value">${conditionLabel(listing.condition)}</div></div>
					<div><div class="spec-label">Box</div><div class="spec-value">${escapeHtml(boxLabel(listing.box_included))}</div></div>
					<div><div class="spec-label">Batch code</div><div class="spec-value">${escapeHtml(listing.batch_code || '—')}</div></div>
					<div><div class="spec-label">Purchased</div><div class="spec-value">${listing.purchase_year || '—'}</div></div>
					<div><div class="spec-label">Gender</div><div class="spec-value" style="text-transform:capitalize;">${escapeHtml(listing.gender || '—')}</div></div>
					<div><div class="spec-label">Listed</div><div class="spec-value">${new Date(listing.created_at).toLocaleDateString()}</div></div>
				</div>

				<div class="notes-tags">
					${(listing.scent_family || []).map((n) => `<span class="chip">${escapeHtml(n)}</span>`).join('')}
				</div>

				<p class="detail-description">${escapeHtml(listing.description || '')}</p>

				<div class="action-row" id="action-row"></div>

				<a class="seller-card" href="profile.html?id=${encodeURIComponent(listing.seller_id)}">
					<div class="avatar">${initials(seller.display_name || seller.username)}</div>
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

	const actionRow = document.getElementById('action-row');
	if (isOwner) {
		actionRow.innerHTML = `
			<button class="btn btn-outline" id="toggle-sold">${listing.status === 'sold' ? 'Mark as available' : 'Mark as sold'}</button>
		`;
		document.getElementById('toggle-sold').addEventListener('click', async (e) => {
			const next = listing.status === 'sold' ? 'available' : 'sold';
			e.target.disabled = true;
			await updateListingStatus(listing.id, next);
			render();
		});
	} else if (listing.status !== 'sold') {
		actionRow.innerHTML = `
			<button class="btn btn-primary" id="btn-offer">Make an offer</button>
			<button class="btn btn-outline" id="btn-contact">Contact seller</button>
		`;
		document.getElementById('btn-offer').addEventListener('click', () => showOfferModal(listing, seller));
		document.getElementById('btn-contact').addEventListener('click', () => showContactModal(seller));
	}
}

function renderImage(img, small = false) {
	if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'))) {
		return `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;${small ? 'border-radius:8px;' : `border-radius:${8}px;`}" />`;
	}
	return img || '🧴';
}

function boxLabel(value) {
	if (value === 'yes') return 'Included';
	if (value === 'damaged') return 'Included (damaged)';
	return 'Not included';
}

function showOfferModal(listing, seller) {
	const overlay = openModal(`
		<span class="modal-close-x" id="modal-close">&times;</span>
		<h3>Make an offer</h3>
		<p class="sub">to ${escapeHtml(seller.display_name || seller.username || 'the seller')} for ${escapeHtml(listing.brand)} ${escapeHtml(listing.name)}</p>
		<div class="form-row">
			<label>Your offer ($)</label>
			<input type="number" id="offer-amount" placeholder="${listing.price}" min="0" />
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
	overlay.querySelector('#offer-send').addEventListener('click', () => {
		overlay.querySelector('.modal-box').innerHTML = `
			<h3>Offer sent</h3>
			<p class="sub">This is a prototype, so no message actually left your browser. Wire up Supabase (or an email/notifications service) to make offers real.</p>
			<div class="modal-actions"><button class="btn btn-outline btn-block" id="modal-done">Close</button></div>
		`;
		overlay.querySelector('#modal-done').addEventListener('click', () => overlay.remove());
	});
}

function showContactModal(seller) {
	const overlay = openModal(`
		<span class="modal-close-x" id="modal-close">&times;</span>
		<h3>Contact seller</h3>
		<p class="sub">${escapeHtml(seller.display_name || seller.username || 'Seller')}</p>
		<div class="form-row">
			<textarea id="contact-message" placeholder="Ask about batch code, shipping, condition..."></textarea>
		</div>
		<div class="modal-actions">
			<button class="btn btn-primary btn-block" id="contact-send">Send message</button>
		</div>
	`);
	overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
	overlay.querySelector('#contact-send').addEventListener('click', () => {
		overlay.querySelector('.modal-box').innerHTML = `
			<h3>Message sent</h3>
			<p class="sub">This is a prototype, so no message actually left your browser. In-app messaging would need a Supabase table (or realtime channel) to store and deliver it.</p>
			<div class="modal-actions"><button class="btn btn-outline btn-block" id="modal-done">Close</button></div>
		`;
		overlay.querySelector('#modal-done').addEventListener('click', () => overlay.remove());
	});
}

render();
