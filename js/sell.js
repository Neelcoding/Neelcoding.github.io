import { getCurrentUser, createListing, SCENT_FAMILIES, CONDITIONS } from './db.js';
import { renderSignedOut as renderSignedOutState } from './empty-state.js';

const root = document.getElementById('sell-root');
let selectedFiles = [];
/** Matches the cap the storage upload loop assumes. */
const MAX_IMAGES = 4;

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
					<div class="image-drop" id="image-drop">Click to choose photos, or drag them here<span class="image-drop-hint">Up to 4. Choose them one at a time if it is easier.</span></div>
					<input type="file" id="s-images" accept="image/*" multiple style="display:none;" />
					<div class="image-preview-row" id="image-preview"></div>
					<p class="hint" id="image-count"></p>
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

	/** Adds to the selection rather than replacing it, and keeps the cap. */
	function addFiles(files) {
		const incoming = [...files].filter((f) => f.type.startsWith('image/'));
		if (!incoming.length) return;
		// Picking a second time used to overwrite the first choice, because the
		// input reports only its own most recent files. Photographing a bottle
		// from several angles means several trips to the picker, so the
		// selection has to accumulate.
		for (const f of incoming) {
			if (selectedFiles.length >= MAX_IMAGES) break;
			// Same file twice is a mis-click, not an intention.
			if (selectedFiles.some((e) => e.name === f.name && e.size === f.size)) continue;
			selectedFiles.push(f);
		}
		// Cleared so choosing the same file again still fires a change event.
		fileInput.value = '';
		renderPreviews();
	}

	fileInput.addEventListener('change', () => addFiles(fileInput.files));

	// Drag and drop never worked: the zone said "drag them here" but nothing
	// listened, so the browser took over and navigated away to the dropped
	// file. The default has to be cancelled on dragover as well as drop, or the
	// drop event is never delivered at all.
	['dragenter', 'dragover'].forEach((evt) => {
		dropZone.addEventListener(evt, (e) => {
			e.preventDefault();
			dropZone.classList.add('is-dragover');
		});
	});
	['dragleave', 'drop'].forEach((evt) => {
		dropZone.addEventListener(evt, (e) => {
			e.preventDefault();
			if (evt === 'dragleave' && dropZone.contains(e.relatedTarget)) return;
			dropZone.classList.remove('is-dragover');
		});
	});
	dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer?.files || []));

	// A file dropped anywhere else would otherwise replace the page with the
	// image, losing a half-filled form.
	['dragover', 'drop'].forEach((evt) => {
		window.addEventListener(evt, (e) => {
			if (!dropZone.contains(e.target)) e.preventDefault();
		});
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
			// published=1 marks the arrival as the moment just after publishing,
			// which is when asking for payout details costs the least: the work
			// is done and there is something concrete to lose by stopping.
			location.href = `listing.html?id=${encodeURIComponent(created.id)}&published=1`;
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
	// Every object URL from the previous pass is revoked before the row is
	// rebuilt; without this each re-render pins another copy of the image in
	// memory for the life of the page.
	wrap.querySelectorAll('img').forEach((img) => URL.revokeObjectURL(img.src));
	wrap.innerHTML = '';

	selectedFiles.forEach((file, i) => {
		const cell = document.createElement('div');
		cell.className = 'image-preview-cell';

		const img = document.createElement('img');
		img.src = URL.createObjectURL(file);
		img.alt = `Photo ${i + 1}`;
		cell.appendChild(img);

		// The first photo is the one buyers see in the grid, so it says so.
		if (i === 0) {
			const tag = document.createElement('span');
			tag.className = 'image-preview-tag';
			tag.textContent = 'Cover';
			cell.appendChild(tag);
		}

		// Choosing the wrong photo used to mean starting the selection over.
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'image-preview-remove';
		remove.setAttribute('aria-label', `Remove photo ${i + 1}`);
		remove.textContent = '×';
		remove.addEventListener('click', () => {
			selectedFiles.splice(i, 1);
			renderPreviews();
		});
		cell.appendChild(remove);

		wrap.appendChild(cell);
	});

	const count = document.getElementById('image-count');
	if (count) {
		count.textContent = selectedFiles.length
			? `${selectedFiles.length} of ${MAX_IMAGES} selected`
			: '';
	}
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
