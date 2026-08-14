import { getCurrentUser, createListing, SCENT_FAMILIES, CONDITIONS } from './db.js';
import { renderSignedOut as renderSignedOutState } from './empty-state.js';

const root = document.getElementById('sell-root');
let selectedFiles = [];

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function renderSignedOut() {
	root.innerHTML = renderSignedOutState({
		title: 'List a bottle',
		body: 'You need an account so buyers know who they are dealing with and can message you about the bottle.',
	});
}

function renderForm(user) {
	root.innerHTML = `
		<h1 style="margin-bottom:6px;">List a bottle</h1>
		<p class="page-lede">Takes a couple of minutes. Be exact about fill and condition. That is what buyers are deciding on.</p>
		<div class="card-panel">
			<div id="form-msg"></div>
			<form id="sell-form">
				<div class="form-grid-2">
					<div class="form-row">
						<label>Brand *</label>
						<input type="text" id="s-brand" placeholder="e.g. Dior" required />
					</div>
					<div class="form-row">
						<label>Name *</label>
						<input type="text" id="s-name" placeholder="e.g. Sauvage EDP" required />
					</div>
				</div>

				<div class="form-grid-2">
					<div class="form-row">
						<label>Gender</label>
						<select id="s-gender">
							<option value="unisex">Unisex</option>
							<option value="men">Men's</option>
							<option value="women">Women's</option>
						</select>
					</div>
					<div class="form-row">
						<label for="s-price">Price (USD) *</label>
						<input type="number" id="s-price" min="1" step="1" required />
						<div class="hint">Buyers can offer under this, so leave yourself a little room.</div>
					</div>
				</div>

				<div class="form-grid-2">
					<div class="form-row">
						<label for="s-size">Size (ml) *</label>
						<input type="number" id="s-size" min="1" required />
						<div class="hint">The bottle's full capacity, printed on the base or the box.</div>
					</div>
					<div class="form-row">
						<label for="s-fill">Fill level (%) *</label>
						<input type="number" id="s-fill" min="1" max="100" required />
						<div class="hint">How full the bottle is now. Eyeball it against the glass: untouched is 100, halfway is 50. Round down if you are unsure.</div>
					</div>
				</div>

				<div class="form-grid-2">
					<div class="form-row">
						<label for="s-condition">Condition *</label>
						<select id="s-condition" required>
							${CONDITIONS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}
						</select>
						<div class="hint">The bottle and its label, not the liquid. Scuffs, a worn atomiser or a faded label all count.</div>
					</div>
					<div class="form-row">
						<label>Box included</label>
						<select id="s-box">
							<option value="yes">Yes</option>
							<option value="no">No</option>
							<option value="damaged">Yes, but damaged</option>
						</select>
					</div>
				</div>

				<div class="form-grid-2">
					<div class="form-row">
						<label for="s-batch">Batch code <span class="label-optional">optional</span></label>
						<input type="text" id="s-batch" placeholder="e.g. 8K01" />
						<div class="hint">A short code stamped on the bottom of the bottle or the box, usually three to five characters. Buyers use it to check age. Skip it if you cannot find one.</div>
					</div>
					<div class="form-row">
						<label for="s-year">Year purchased <span class="label-optional">optional</span></label>
						<input type="number" id="s-year" min="1990" max="2026" placeholder="2024" />
						<div class="hint">Roughly is fine. Helps buyers judge how it has been stored.</div>
					</div>
				</div>

				<div class="form-row">
					<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
						<input type="checkbox" id="s-auction" style="width:auto;" />
						Sell as an auction instead of a fixed price
					</label>
					<div class="hint">Buyers bid starting from your price above; highest bid wins when time runs out.</div>
				</div>

				<div class="form-row" id="auction-days-row" style="display:none;">
					<label>Auction length (days) *</label>
					<input type="number" id="s-auction-days" min="1" max="7" value="3" />
					<div class="hint">Maximum 7 days.</div>
				</div>

				<div class="form-row">
					<label>Scent family</label>
					<div class="tag-select">
						${SCENT_FAMILIES.map((f) => `<label><input type="checkbox" name="s-notes" value="${f}" style="display:none;" /><span style="text-transform:capitalize;">${f}</span></label>`).join('')}
					</div>
				</div>

				<div class="form-row">
					<label>Description</label>
					<textarea id="s-description" placeholder="Why are you selling? Any wear, storage conditions, etc."></textarea>
				</div>

				<div class="form-row">
					<label>Photos (up to 4)</label>
					<div class="image-drop" id="image-drop">Click to choose photos, or drag them here</div>
					<input type="file" id="s-images" accept="image/*" multiple style="display:none;" />
					<div class="image-preview-row" id="image-preview"></div>
					<div class="hint">Real photos (including the batch code) build buyer trust.</div>
				</div>

				<button class="btn btn-primary btn-block" type="submit" id="submit-btn">Publish listing</button>
			</form>
		</div>
	`;

	// tag-select toggle behaviour (checkbox is hidden; label click toggles state class)
	document.querySelectorAll('.tag-select label').forEach((label) => {
		label.addEventListener('click', (e) => {
			e.preventDefault();
			const input = label.querySelector('input');
			setTagActive(input, !input.checked);
		});
	});

	document.getElementById('s-auction').addEventListener('change', (e) => {
		document.getElementById('auction-days-row').style.display = e.target.checked ? '' : 'none';
	});

	const dropZone = document.getElementById('image-drop');
	const fileInput = document.getElementById('s-images');
	dropZone.addEventListener('click', () => fileInput.click());
	fileInput.addEventListener('change', () => {
		selectedFiles = [...fileInput.files].slice(0, 4);
		renderPreviews();
	});

	document.getElementById('sell-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const submitBtn = document.getElementById('submit-btn');
		submitBtn.disabled = true;
		submitBtn.textContent = 'Publishing…';
		try {
			const isAuction = document.getElementById('s-auction').checked;
			const auctionDays = Math.min(7, Math.max(1, Number(document.getElementById('s-auction-days').value) || 3));
			const listing = {
				seller_id: user.id,
				brand: val('s-brand'),
				name: val('s-name'),
				gender: val('s-gender'),
				price: Number(val('s-price')),
				size_ml: Number(val('s-size')),
				fill_percentage: Number(val('s-fill')),
				condition: val('s-condition'),
				box_included: val('s-box'),
				batch_code: val('s-batch'),
				purchase_year: val('s-year') ? Number(val('s-year')) : null,
				scent_family: [...document.querySelectorAll('input[name="s-notes"]:checked')].map((i) => i.value),
				description: val('s-description'),
				is_auction: isAuction,
				auction_ends_at: isAuction ? new Date(Date.now() + auctionDays * 86400000).toISOString() : null,
			};
			const created = await createListing(listing, selectedFiles);
			location.href = `listing.html?id=${encodeURIComponent(created.id)}`;
		} catch (err) {
			showMsg(err.message || 'Could not publish listing.', 'error');
			submitBtn.disabled = false;
			submitBtn.textContent = 'Publish listing';
		}
	});
}

function val(id) {
	return document.getElementById(id).value.trim();
}

function renderPreviews() {
	const wrap = document.getElementById('image-preview');
	wrap.innerHTML = '';
	selectedFiles.forEach((file) => {
		const img = document.createElement('img');
		img.src = URL.createObjectURL(file);
		wrap.appendChild(img);
	});
}

function showMsg(text, type) {
	const el = document.getElementById('form-msg');
	if (el) el.innerHTML = `<div class="form-msg ${type}">${escapeHtml(text)}</div>`;
}

function setTagActive(input, active) {
	input.checked = active;
	const label = input.closest('label');
	label.classList.toggle('active', active);
	label.style.background = active ? 'var(--ink)' : '';
	label.style.color = active ? 'var(--cream)' : '';
	label.style.borderColor = active ? 'var(--ink)' : '';
}

(async function init() {
	const user = await getCurrentUser();
	if (!user) return renderSignedOut();
	renderForm(user);
})();
