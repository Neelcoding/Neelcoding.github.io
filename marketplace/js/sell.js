import { getCurrentUser, createListing, SCENT_FAMILIES, CONDITIONS } from './db.js';

const root = document.getElementById('sell-root');
let selectedFiles = [];

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function renderSignedOut() {
	root.innerHTML = `
		<div class="card-panel" style="text-align:center;">
			<h2 style="margin-top:0;">Sign in to list a fragrance</h2>
			<p style="color:var(--ink-soft);">You'll need an account so buyers know who they're dealing with.</p>
			<a href="account.html" class="btn btn-primary">Sign in / Create account</a>
		</div>
	`;
}

function renderForm(user) {
	root.innerHTML = `
		<h1 style="margin-bottom:6px;">List a fragrance</h1>
		<p style="color:var(--ink-soft);margin-top:0 0 24px;">Accurate fill level and condition details help your listing sell faster.</p>
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
						<label>Price (USD) *</label>
						<input type="number" id="s-price" min="1" step="1" required />
					</div>
				</div>

				<div class="form-grid-2">
					<div class="form-row">
						<label>Size (ml) *</label>
						<input type="number" id="s-size" min="1" required />
					</div>
					<div class="form-row">
						<label>Fill level (%) *</label>
						<input type="number" id="s-fill" min="1" max="100" required />
					</div>
				</div>

				<div class="form-grid-2">
					<div class="form-row">
						<label>Condition *</label>
						<select id="s-condition" required>
							${CONDITIONS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}
						</select>
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
						<label>Batch code</label>
						<input type="text" id="s-batch" placeholder="Helps buyers verify authenticity" />
					</div>
					<div class="form-row">
						<label>Year purchased</label>
						<input type="number" id="s-year" min="1990" max="2026" placeholder="2024" />
					</div>
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
			input.checked = !input.checked;
			label.classList.toggle('active', input.checked);
			label.style.background = input.checked ? 'var(--ink)' : '';
			label.style.color = input.checked ? 'var(--cream)' : '';
			label.style.borderColor = input.checked ? 'var(--ink)' : '';
		});
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

(async function init() {
	const user = await getCurrentUser();
	if (!user) return renderSignedOut();
	renderForm(user);
})();
