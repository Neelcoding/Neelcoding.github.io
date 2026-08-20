// Assay estimator — interaction layer.
//
// Self-contained on purpose: no GSAP, no framework, no imports outside this
// folder's own data module. The estimator is meant to be liftable onto its own
// surface later, so its only dependency on the marketplace is the stylesheet's
// design tokens.
//
// Motion is hand-rolled rather than library-driven because there are only three
// moving things worth animating — the counted value, the range marker, and the
// progress line — and all three want to be interruptible.

import {
	CATALOGUE, CONDITIONS, COMPLETENESS, REGIMES, THIS_YEAR,
	estimate, compsFor, trendFor, provenance,
} from './estimate-data.js';
import { hydrate, loadCatalogue, logValuation } from './estimate-source.js';

// Swapped for the Supabase catalogue at boot when one is available.
let catalogue = CATALOGUE;

const $ = (sel, root = document) => root.querySelector(sel);

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function escapeHtml(str) {
	const d = document.createElement('div');
	d.textContent = String(str);
	return d.innerHTML;
}

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

/* ---------- Icons ---------- */

const ICON_SEARCH = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const ICON_BOTTLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><path d="M11 2v3.2c0 .5-.2 1-.6 1.4L9 8c-.6.6-1 1.5-1 2.4V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9.6c0-.9-.4-1.8-1-2.4l-1.4-1.4c-.4-.4-.6-.9-.6-1.4V2"/><path d="M8 13h8"/></svg>`;
const ICON_TICK = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_ARROW = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>`;
const ICON_SPLIT = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h6l3-7 3 14 3-7h3"/></svg>`;

/* ---------- State ---------- */

const state = {
	item: null,
	size: null,
	fill: 80,
	condition: 'mint',
	completeness: 'full',
	batchYear: THIS_YEAR - 3,
	purchaseYear: THIS_YEAR - 2,
	trendRange: '1Y',
};

let phase = 'empty';   // empty | ready | working | done | stale
let result = null;
let countRaf = null;
let progressRaf = null;

/* ---------- Search combobox ---------- */

function initCombo() {
	const wrap = $('#combo');
	wrap.innerHTML = `
		<div class="combo-field">
			${ICON_SEARCH}
			<input
				type="text"
				id="combo-input"
				role="combobox"
				autocomplete="off"
				aria-expanded="false"
				aria-controls="combo-list"
				aria-autocomplete="list"
				aria-label="Search for a fragrance"
				placeholder="Search a fragrance by name or house…" />
			<span class="combo-hint">&#8595;&#8593; to browse</span>
		</div>
		<ul class="combo-list" id="combo-list" role="listbox" aria-label="Matching fragrances"></ul>`;

	const input = $('#combo-input');
	const list = $('#combo-list');
	let matches = [];
	let active = -1;

	const close = () => {
		list.classList.remove('open');
		input.setAttribute('aria-expanded', 'false');
		input.removeAttribute('aria-activedescendant');
		active = -1;
	};

	function paint() {
		if (!matches.length) {
			list.innerHTML = `<li class="combo-empty">No match. Try &ldquo;Aventus&rdquo; or &ldquo;Guerlain&rdquo;.</li>`;
			return;
		}
		const q = input.value.trim().toLowerCase();
		list.innerHTML = matches.map((m, i) => {
			const name = q ? highlight(m.name, q) : escapeHtml(m.name);
			// A row whose name shows no match looks like a false positive. When
			// the hit came from the house or the scent family instead, show that
			// field in place of the year so the match explains itself.
			const nameHit = q && m.name.toLowerCase().includes(q);
			let meta = `${escapeHtml(m.house)} &middot; ${m.released}`;
			if (q && !nameHit) {
				if (m.house.toLowerCase().includes(q)) meta = `${highlight(m.house, q)} &middot; ${m.released}`;
				else if (m.family.toLowerCase().includes(q)) meta = `${escapeHtml(m.house)} &middot; ${highlight(m.family, q)}`;
			}
			return `<li class="combo-opt" id="opt-${m.id}" role="option" aria-selected="${i === active}" data-id="${m.id}">
				<strong>${name}</strong>
				<span class="house">${meta}</span>
			</li>`;
		}).join('');
		if (active >= 0) input.setAttribute('aria-activedescendant', `opt-${matches[active].id}`);
	}

	function highlight(text, q) {
		const i = text.toLowerCase().indexOf(q);
		if (i < 0) return escapeHtml(text);
		return escapeHtml(text.slice(0, i)) + '<mark>' + escapeHtml(text.slice(i, i + q.length)) + '</mark>' + escapeHtml(text.slice(i + q.length));
	}

	function search(q) {
		const s = q.trim().toLowerCase();
		matches = s
			? catalogue.filter((c) => `${c.name} ${c.house} ${c.family}`.toLowerCase().includes(s))
			: catalogue.slice(0, 6);
		active = matches.length ? 0 : -1;
		paint();
		list.classList.add('open');
		input.setAttribute('aria-expanded', 'true');
	}

	input.addEventListener('input', () => search(input.value));
	input.addEventListener('focus', () => search(input.value));

	input.addEventListener('keydown', (e) => {
		if (!list.classList.contains('open')) {
			if (e.key === 'ArrowDown') { search(input.value); e.preventDefault(); }
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!matches.length) return;
			active = e.key === 'ArrowDown'
				? (active + 1) % matches.length
				: (active - 1 + matches.length) % matches.length;
			paint();
			list.children[active]?.scrollIntoView({ block: 'nearest' });
		} else if (e.key === 'Enter') {
			if (active >= 0 && matches[active]) { e.preventDefault(); select(matches[active].id); }
		} else if (e.key === 'Escape') {
			close();
		}
	});

	list.addEventListener('mousedown', (e) => {
		// mousedown, not click: blur would close the list first.
		const opt = e.target.closest('.combo-opt');
		if (opt) { e.preventDefault(); select(opt.dataset.id); }
	});

	list.addEventListener('mousemove', (e) => {
		const opt = e.target.closest('.combo-opt');
		if (!opt) return;
		const i = matches.findIndex((m) => m.id === opt.dataset.id);
		if (i >= 0 && i !== active) { active = i; paint(); }
	});

	document.addEventListener('click', (e) => {
		if (!wrap.contains(e.target)) close();
	});

	function select(id) {
		const item = catalogue.find((c) => c.id === id);
		if (!item) return;
		input.value = '';
		close();
		input.blur();
		selectItem(item);
	}
}

/* ---------- Item selection ---------- */

function selectItem(item) {
	state.item = item;
	state.size = item.defaultSize;
	state.fill = 80;
	state.condition = 'mint';
	state.completeness = 'full';
	const minBatch = batchFloor(item);
	state.batchYear = Math.max(minBatch, Math.min(THIS_YEAR - 3, THIS_YEAR));
	state.purchaseYear = Math.max(state.batchYear, THIS_YEAR - 2);
	phase = 'ready';
	result = null;
	renderIdentity();
	renderConfig();
	renderResult();
	$('#combo').hidden = true;

	const btn = $('#est-btn');
	btn.disabled = false;
	btn.querySelector('.label').textContent = 'Estimate price';
	$('#est-status').textContent = 'Ready to run';
	btn.focus({ preventScroll: true });

	// Real observations are fetched in the background. The form is already
	// usable off the bundled set, so this never blocks; if live data arrives
	// the panel quietly re-renders with it.
	hydrate(item.id).then((got) => {
		if (got && state.item?.id === item.id) {
			renderProvenance();
			renderResult();
		}
	});
}

function clearItem() {
	state.item = null;
	phase = 'empty';
	result = null;
	$('#combo').hidden = false;
	renderIdentity();
	renderConfig();
	renderResult();

	const btn = $('#est-btn');
	btn.disabled = true;
	btn.querySelector('.label').textContent = 'Estimate price';
	btn.querySelector('.progress').style.width = '0%';
	$('#est-status').textContent = 'Select a bottle to begin';
	$('#est-result').classList.remove('is-stale');
	$('#stale-bar').hidden = true;
	$('#combo-input')?.focus();
}

function batchFloor(item) {
	return Math.max(item.released, THIS_YEAR - (item.regime === 'C' ? 45 : 20));
}

function renderIdentity() {
	const el = $('#identity');
	if (!state.item) { el.innerHTML = ''; el.hidden = true; return; }
	const it = state.item;
	const regime = REGIMES[it.regime];
	el.hidden = false;
	el.innerHTML = `
		<div class="identity">
			<div class="identity-thumb">${ICON_BOTTLE}</div>
			<div>
				<div style="display:flex;align-items:flex-start;gap:8px;">
					<div style="min-width:0;flex:1;">
						<h3 class="identity-name">${escapeHtml(it.name)}</h3>
						<p class="identity-meta">${escapeHtml(it.house)} &middot; ${it.released} &middot; ${escapeHtml(it.family)}</p>
					</div>
					<button type="button" class="identity-clear" id="identity-clear" aria-label="Choose a different fragrance">${ICON_CLOSE}</button>
				</div>
				<div class="identity-tags">
					<span class="regime">Regime ${regime.code} &middot; ${escapeHtml(regime.label)}</span>
					<span>${escapeHtml(regime.anchor)}</span>
				</div>
			</div>
		</div>`;
	$('#identity-clear').addEventListener('click', clearItem);
}

/* ---------- Configuration controls ---------- */

function renderConfig() {
	const el = $('#config');
	if (!state.item) { el.innerHTML = ''; el.hidden = true; return; }
	el.hidden = false;
	const it = state.item;
	const minBatch = batchFloor(it);

	el.innerHTML = `
		<div class="est-step">
			<span class="n">02</span>
			<h2>Describe the bottle</h2>
			<span class="rule"></span>
		</div>

		<div class="attr">
			<div class="attr-head">
				<span class="lbl" id="lbl-size">Bottle size</span>
				${it.sizes.length > 1 ? '' : `<span class="attr-value">${it.sizes[0]} ml</span>`}
			</div>
			${it.sizes.length > 1 ? `
			<div class="seg" role="radiogroup" aria-labelledby="lbl-size" id="ctl-size">
				${it.sizes.map((s) => `
					<button type="button" role="radio" aria-checked="${s === state.size}" data-v="${s}" tabindex="${s === state.size ? 0 : -1}">
						${s}<span class="unit">ML</span>
					</button>`).join('')}
			</div>`
			// A bottle that only ever shipped in one size still has to say which
			// one, or the reader is left guessing what the estimate refers to.
			: `<p class="only-size">${escapeHtml(it.house)} only released this in one size.</p>`}
		</div>

		<div class="attr">
			<div class="attr-head">
				<label for="ctl-fill">Fill level</label>
				<span class="attr-value" id="fill-ml">${Math.round(state.size * state.fill / 100)} of ${state.size} ml</span>
			</div>
			<div class="gauge">
				<div class="gauge-readout">
					<span class="pct" id="fill-pct">${state.fill}%</span>
					<span class="ml">remaining</span>
				</div>
				<div class="gauge-track" id="gauge-track" style="--fill:${state.fill}%">
					<div class="gauge-fill"></div>
					<div class="gauge-ticks">${'<i></i>'.repeat(10)}</div>
					<div class="gauge-edge"></div>
					<input type="range" id="ctl-fill" min="5" max="100" step="1" value="${state.fill}"
						aria-label="Fill level, percent remaining"
						aria-valuetext="${state.fill} percent remaining" />
				</div>
				<div class="gauge-scale"><span>Empty</span><span>Half</span><span>Sealed</span></div>
			</div>
		</div>

		<div class="attr">
			<div class="attr-head"><span class="lbl" id="lbl-cond">Condition of the bottle</span></div>
			<div class="tiles" role="radiogroup" aria-labelledby="lbl-cond" id="ctl-condition">
				${CONDITIONS.map((c) => `
					<button type="button" class="tile" role="radio" aria-checked="${c.id === state.condition}" data-v="${c.id}" tabindex="${c.id === state.condition ? 0 : -1}">
						<span class="t">${escapeHtml(c.label)}</span>
						<span class="d">${escapeHtml(c.detail)}</span>
						<span class="tick">${ICON_TICK}</span>
					</button>`).join('')}
			</div>
		</div>

		<div class="attr">
			<div class="attr-head"><span class="lbl" id="lbl-comp">Original box</span></div>
			<div class="seg" role="radiogroup" aria-labelledby="lbl-comp" id="ctl-completeness">
				${COMPLETENESS.map((c) => `
					<button type="button" role="radio" aria-checked="${c.id === state.completeness}" data-v="${c.id}" tabindex="${c.id === state.completeness ? 0 : -1}">
						${escapeHtml(c.label)}
					</button>`).join('')}
			</div>
		</div>

		<div class="attr">
			<div class="attr-head">
				<span class="label-info">
					<label for="ctl-batch">Batch year</label>
					<button type="button" class="info-btn" id="batch-info-btn"
						aria-expanded="false" aria-controls="batch-info" aria-label="What is a batch year?">i</button>
				</span>
				<span class="attr-value" id="batch-val">${state.batchYear}</span>
			</div>
			<div class="info-pop" id="batch-info" role="dialog" aria-label="Batch year" hidden>
				<p class="info-t">The production date, coded.</p>
				<p>A short code stamped into the base of the bottle, often on the box near the barcode.</p>
				<p>The year is usually the first one or two characters.</p>
				<p class="info-f">Not sure? Leave it. Purchase year carries the estimate.</p>
			</div>
			<div class="rail">
				<div class="rail-track" id="rail-track" style="--pos:${railPos(minBatch)}%">
					<div class="rail-line"></div>
					<div class="rail-ticks">${railTicks(minBatch)}</div>
					<div class="rail-marker"></div>
					<input type="range" id="ctl-batch" min="${minBatch}" max="${THIS_YEAR}" step="1" value="${state.batchYear}"
						aria-label="Batch year, read from the batch code"
						aria-valuetext="${state.batchYear}" />
				</div>
				<div class="rail-scale"><span>${minBatch}</span><span>${THIS_YEAR}</span></div>
			</div>
		</div>

		<div class="attr">
			<div class="attr-head"><span class="lbl" id="lbl-purchase">Purchase year</span></div>
			<div style="display:flex;align-items:center;flex-wrap:wrap;">
				<div class="stepper" role="group" aria-labelledby="lbl-purchase" id="ctl-purchase">
					<button type="button" data-step="-1" aria-label="Earlier purchase year">&minus;</button>
					<span class="val" id="purchase-val" aria-live="polite">${state.purchaseYear}</span>
					<button type="button" data-step="1" aria-label="Later purchase year">+</button>
				</div>
				<span class="derived">Owned <b id="owned-val">${THIS_YEAR - state.purchaseYear} yr</b></span>
			</div>
		</div>`;

	wireRadioGroup('#ctl-size', (v) => {
		state.size = Number(v);
		state.fill = Math.min(state.fill, 100);
		updateFillReadout();
		markStale();
	});
	wireRadioGroup('#ctl-condition', (v) => { state.condition = v; markStale(); });
	wireRadioGroup('#ctl-completeness', (v) => { state.completeness = v; markStale(); });

	wireRange('#ctl-fill', (v) => {
		state.fill = v;
		$('#gauge-track').style.setProperty('--fill', v + '%');
		$('#ctl-fill').setAttribute('aria-valuetext', `${v} percent remaining`);
		updateFillReadout();
		markStale();
	});

	wireRange('#ctl-batch', (v) => {
		state.batchYear = v;
		$('#batch-val').textContent = v;
		$('#rail-track').style.setProperty('--pos', railPos(minBatch) + '%');
		$('#ctl-batch').setAttribute('aria-valuetext', String(v));
		if (state.purchaseYear < v) { state.purchaseYear = v; updatePurchase(); }
		updatePurchaseBounds();
		markStale();
	});

	wireInfo();

	$('#ctl-purchase').addEventListener('click', (e) => {
		const btn = e.target.closest('button[data-step]');
		if (!btn || btn.disabled) return;
		const next = state.purchaseYear + Number(btn.dataset.step);
		if (next < state.batchYear || next > THIS_YEAR) return;
		state.purchaseYear = next;
		updatePurchase();
		markStale();
	});
	updatePurchaseBounds();
}

/** Disclosure popover for the batch-year explainer. */
function wireInfo() {
	const btn = $('#batch-info-btn');
	const pop = $('#batch-info');
	if (!btn || !pop) return;

	const close = () => {
		pop.hidden = true;
		btn.setAttribute('aria-expanded', 'false');
	};
	const open = () => {
		pop.hidden = false;
		btn.setAttribute('aria-expanded', 'true');
	};

	btn.addEventListener('click', (e) => {
		e.stopPropagation();
		pop.hidden ? open() : close();
	});
	document.addEventListener('click', (e) => {
		if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) close();
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !pop.hidden) { close(); btn.focus(); }
	});
}

function railPos(min) {
	return ((state.batchYear - min) / Math.max(1, THIS_YEAR - min)) * 100;
}

function railTicks(min) {
	const span = THIS_YEAR - min;
	const step = span > 26 ? 5 : span > 14 ? 2 : 1;
	let out = '';
	for (let y = min; y <= THIS_YEAR; y += step) {
		out += `<i class="${(y - min) % (step * 5) === 0 ? 'major' : ''}"></i>`;
	}
	return out;
}

function updateFillReadout() {
	$('#fill-pct').textContent = state.fill + '%';
	$('#fill-ml').textContent = `${Math.round(state.size * state.fill / 100)} of ${state.size} ml`;
}

function updatePurchase() {
	$('#purchase-val').textContent = state.purchaseYear;
	const owned = THIS_YEAR - state.purchaseYear;
	$('#owned-val').textContent = `${owned} yr`;
	updatePurchaseBounds();
}

function updatePurchaseBounds() {
	const group = $('#ctl-purchase');
	if (!group) return;
	group.querySelector('[data-step="-1"]').disabled = state.purchaseYear <= state.batchYear;
	group.querySelector('[data-step="1"]').disabled = state.purchaseYear >= THIS_YEAR;
}

/** Roving-tabindex radio group with arrow-key navigation. */
function wireRadioGroup(sel, onChange) {
	const group = $(sel);
	if (!group) return;
	const opts = () => Array.from(group.querySelectorAll('[role="radio"]'));

	const set = (btn) => {
		opts().forEach((o) => {
			const on = o === btn;
			o.setAttribute('aria-checked', String(on));
			o.tabIndex = on ? 0 : -1;
		});
		onChange(btn.dataset.v);
	};

	group.addEventListener('click', (e) => {
		const btn = e.target.closest('[role="radio"]');
		if (btn) set(btn);
	});

	group.addEventListener('keydown', (e) => {
		const list = opts();
		const i = list.indexOf(document.activeElement);
		if (i < 0) return;
		let next = null;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = list[(i + 1) % list.length];
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = list[(i - 1 + list.length) % list.length];
		else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(list[i]); return; }
		if (next) { e.preventDefault(); next.focus(); set(next); }
	});
}

function wireRange(sel, onInput) {
	const input = $(sel);
	if (!input) return;
	input.addEventListener('input', () => onInput(Number(input.value)));
	// :has() covers the focus ring in modern browsers; the class keeps it
	// working where it doesn't.
	input.addEventListener('focus', () => input.parentElement.classList.add('is-focus'));
	input.addEventListener('blur', () => input.parentElement.classList.remove('is-focus'));
}

/* ---------- Estimate action ---------- */

const STATUS_STEPS = [
	'Matching comparable sales',
	'Applying condition factors',
	'Checking decant split value',
	'Settling range',
];

function initAction() {
	$('#est-btn').addEventListener('click', runEstimate);
}

async function runEstimate() {
	if (!state.item || phase === 'working') return;
	const btn = $('#est-btn');
	const status = $('#est-status');
	const bar = btn.querySelector('.progress');

	phase = 'working';
	btn.classList.add('is-working');
	btn.disabled = true;
	btn.querySelector('.label').textContent = 'Estimating';
	$('#est-result').classList.remove('is-stale');
	$('#stale-bar').hidden = true;

	const total = reduceMotion() ? 180 : 880;
	const t0 = performance.now();

	// The progress line and the status text are driven off one clock so they
	// can never disagree about how far along the run is.
	//
	// A timer owns completion, not the frame loop: requestAnimationFrame stops
	// firing in a backgrounded tab, and a run that resolved off rAF alone left
	// the button stuck on "Estimating" for anyone who switched away mid-run.
	// The frame loop only paints.
	await new Promise((resolve) => {
		const tick = (now) => {
			const p = Math.min(1, (now - t0) / total);
			bar.style.width = (p * 100).toFixed(1) + '%';
			const stepIndex = Math.min(STATUS_STEPS.length - 1, Math.floor(p * STATUS_STEPS.length));
			if (status.textContent !== STATUS_STEPS[stepIndex]) status.textContent = STATUS_STEPS[stepIndex];
			if (p < 1) progressRaf = requestAnimationFrame(tick);
		};
		progressRaf = requestAnimationFrame(tick);
		setTimeout(() => {
			if (progressRaf) cancelAnimationFrame(progressRaf);
			progressRaf = null;
			resolve();
		}, total);
	});

	result = estimate(state);
	phase = 'done';
	if (!result.refused) logValuation(state.item.id, { ...state, item: state.item.id }, result);

	btn.classList.remove('is-working');
	btn.disabled = false;
	btn.querySelector('.label').textContent = 'Re-estimate';
	bar.style.width = '0%';
	status.textContent = `Run against ${result.compCount} comparable ${result.compCount === 1 ? 'sale' : 'sales'}`;

	renderResult();
}

function markStale() {
	if (phase !== 'done' && phase !== 'stale') return;
	phase = 'stale';
	$('#est-result').classList.add('is-stale');
	$('#stale-bar').hidden = false;
	$('#est-sticky').classList.add('stale');
	$('#est-btn .label').textContent = 'Update estimate';
}

/* ---------- Result ---------- */

function renderResult() {
	const readout = $('#readout');
	const support = $('#support');
	const head = $('#result-meta');

	if (!result) {
		head.textContent = state.item ? 'Awaiting run' : 'No bottle selected';
		readout.className = 'readout is-empty';
		readout.innerHTML = emptyReadout();
		const hasItem = !!state.item;
		support.className = 'support-stack' + (hasItem ? '' : ' is-empty');
		support.innerHTML = supportMarkup(hasItem ? compsFor(state.item.id, state.size) : [], null, !hasItem);
		hideSticky();
		wireTrend();
		return;
	}

	if (result.refused) {
		head.textContent = 'Declined';
		readout.className = 'refusal';
		readout.innerHTML = `
			<div class="rlabel">Not enough evidence</div>
			<h3>We won&rsquo;t put a number on this one.</h3>
			<p>Only ${result.compCount} comparable ${result.compCount === 1 ? 'sale' : 'sales'} in this size, and a discontinued bottle prices off its formula era rather than its fill. A confident figure here would be a guess wearing a decimal point. The sales we do have are listed below.</p>`;
		support.className = 'support-stack';
		support.innerHTML = supportMarkup(compsFor(state.item.id, state.size), null, false);
		hideSticky();
		wireTrend();
		return;
	}

	head.innerHTML = `Regime ${result.regime.code} <span style="opacity:.5">&middot;</span> ${result.anchorLabel} ${money(result.anchor)}`;

	readout.className = 'readout';
	readout.innerHTML = `
		<div class="readout-label">Estimated market value</div>
		<div class="readout-value"><span class="cur">$</span><span id="value-digits">0</span></div>
		<div class="readout-sub">
			<span>Expected range <b>${money(result.low)} &ndash; ${money(result.high)}</b></span>
			<span class="dot">&#124;</span>
			<div class="conf">
				<div class="conf-bars" role="img" aria-label="Confidence: ${result.confidence}">
					${[1, 2, 3].map((i) => `<i class="${confLevel(result.confidence) >= i ? 'on' : ''}"></i>`).join('')}
				</div>
				<span class="conf-label">${result.confidence} confidence</span>
			</div>
		</div>

		<div class="rangeviz">
			<div class="rangeviz-head">
				<span>Against ${result.compCount} recent ${state.size}ml sales</span>
				<span class="caption">Shaded band is the expected range</span>
			</div>
			<div class="rangeviz-plot">
				${distributionSvg(result, compsFor(state.item.id, state.size))}
				<div class="range-marker" id="range-marker" style="left:50%"></div>
			</div>
			<div class="rangeviz-bounds">
				<div><span>Low market</span>${money(plotDomain(result, compsFor(state.item.id, state.size)).min)}</div>
				<div class="hi"><span>High market</span>${money(plotDomain(result, compsFor(state.item.id, state.size)).max)}</div>
			</div>
		</div>

		${result.floorBinds ? `
			<div class="floor-note">
				${ICON_SPLIT}
				<div>Split value is carrying this price. Broken into decants the remaining ${Math.round(state.size * state.fill / 100)}ml is worth about <b>${money(result.splitFloor)}</b>, which sits above what the street model returns, so nobody sells it whole for less.</div>
			</div>` : ''}`;

	support.className = 'support-stack';
	support.innerHTML = supportMarkup(compsFor(state.item.id, state.size), result, false);

	wireTrend();
	animateValue(result.value);
	animateMarker(result);
	animateFactors();

	const sticky = $('#est-sticky');
	sticky.classList.remove('stale');
	sticky.classList.add('show');
	sticky.setAttribute('aria-hidden', 'false');
	sticky.querySelector('.v').textContent = money(result.value);
	sticky.querySelector('.r').innerHTML = `${money(result.low)} &ndash; ${money(result.high)}<br>${result.confidence} confidence`;
}

/** The masthead must not claim mock data is real, or real data is mock. */
function renderProvenance() {
	const el = $('#est-provenance-data');
	if (!el) return;
	const p = state.item ? provenance(state.item.id) : { live: false };
	if (!p.live) {
		el.innerHTML = 'Mock data';
		return;
	}
	el.innerHTML = p.sold
		? `Live data &middot; <b>${p.comps}</b> observations`
		: `Live asking prices &middot; <b>${p.comps}</b> listings`;
}

function confLevel(c) {
	return c === 'High' ? 3 : c === 'Medium' ? 2 : 1;
}

function emptyReadout() {
	return `
		<div class="readout-label">Estimated market value</div>
		<div class="readout-value"><span class="cur">$</span><span>0,000</span></div>
		<div class="readout-sub"><span>Expected range <b>$0,000 &ndash; $0,000</b></span></div>
		<div class="rangeviz">
			<div class="rangeviz-head"><span>Against recent sales</span><span class="caption">Shaded band is the expected range</span></div>
			<div class="rangeviz-plot">
				<svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
					<line class="dist-axis" x1="0" y1="41" x2="100" y2="41" />
				</svg>
				<div class="range-marker" style="left:50%"></div>
			</div>
			<div class="rangeviz-bounds"><div><span>Low market</span>$0,000</div><div class="hi"><span>High market</span>$0,000</div></div>
		</div>
		<p class="empty-note">${state.item
			? 'Configuration set. Run the estimate and the value, its range, and the factors that moved it will appear here.'
			: 'Pick a bottle to begin. The valuation, its expected range, and the comparable sales behind it will appear in this panel.'}</p>`;
}

/* ---------- Range distribution ----------
   Plotted from the confidence band, with each comparable sale drawn as a tick
   on the axis so the curve is visibly answerable to the data under it. */

function plotDomain(r, comps) {
	// The axis is the market, not the estimate. Scaling it to the confidence
	// band alone put the marker at dead centre every single time, which made
	// its position decorative — it could never tell you anything.
	const prices = comps.map((c) => c.price);
	const lo = Math.min(r.low, ...(prices.length ? prices : [r.low]));
	const hi = Math.max(r.high, ...(prices.length ? prices : [r.high]));
	const pad = (hi - lo) * 0.08 || 1;
	return { min: lo - pad, max: hi + pad };
}

function distributionSvg(r, comps) {
	const { min, max } = plotDomain(r, comps);
	const span = max - min || 1;
	const x = (v) => ((v - min) / span) * 100;

	const sigma = (r.high - r.low) / 3.2 || 1;
	let top = '';
	for (let i = 0; i <= 90; i++) {
		const px = (i / 90) * 100;
		const val = min + (px / 100) * span;
		const y = 38 - 33 * Math.exp(-0.5 * Math.pow((val - r.value) / sigma, 2));
		top += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${y.toFixed(2)} `;
	}

	const bandX = x(r.low);
	const bandW = Math.max(0.4, x(r.high) - x(r.low));

	const ticks = comps
		.map((c) => x(c.price))
		.filter((px) => px >= 0 && px <= 100)
		.map((px) => `<line class="comp-tick" x1="${px.toFixed(2)}" y1="33" x2="${px.toFixed(2)}" y2="41" vector-effect="non-scaling-stroke" />`)
		.join('');

	return `<svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="Estimated value ${money(r.value)}, expected range ${money(r.low)} to ${money(r.high)}, plotted against ${comps.length} recent sales from ${money(min)} to ${money(max)}">
		<rect class="band-fill" x="${bandX.toFixed(2)}" y="0" width="${bandW.toFixed(2)}" height="41" />
		<path class="dist-fill" d="${top} L100,41 L0,41 Z" />
		<path class="dist-line" d="${top}" vector-effect="non-scaling-stroke" />
		<line class="dist-axis" x1="0" y1="41" x2="100" y2="41" vector-effect="non-scaling-stroke" />
		${ticks}
	</svg>`;
}

function animateMarker(r) {
	const marker = $('#range-marker');
	if (!marker) return;
	const { min, max } = plotDomain(r, compsFor(state.item.id, state.size));
	const pos = ((r.value - min) / (max - min || 1)) * 100;
	if (reduceMotion()) { marker.style.left = pos + '%'; return; }
	marker.style.left = '50%';
	// The marker's position is data, not decoration: it says where the estimate
	// falls inside its own range. Both paths are idempotent, so whichever fires
	// first wins and a throttled frame loop can't strand it at centre.
	const settle = () => { if (marker.isConnected) marker.style.left = pos + '%'; };
	requestAnimationFrame(settle);
	setTimeout(settle, 60);
}

function hideSticky() {
	const sticky = $('#est-sticky');
	sticky.classList.remove('show');
	sticky.setAttribute('aria-hidden', 'true');
}

/* ---------- Value count ---------- */

function animateValue(target) {
	const el = $('#value-digits');
	if (!el) return;
	if (countRaf) cancelAnimationFrame(countRaf);
	if (reduceMotion()) { el.textContent = Math.round(target).toLocaleString('en-US'); return; }

	const dur = 620;
	const t0 = performance.now();
	// Starting at ~62% keeps the digits reading as a settling instrument rather
	// than a slot machine spinning up from zero.
	const from = target * 0.62;
	const step = (now) => {
		const p = Math.min(1, (now - t0) / dur);
		const eased = 1 - Math.pow(1 - p, 3);
		el.textContent = Math.round(from + (target - from) * eased).toLocaleString('en-US');
		if (p < 1) countRaf = requestAnimationFrame(step);
	};
	countRaf = requestAnimationFrame(step);
	// Same guarantee as the run itself: the true figure lands even if the frame
	// loop never runs, so the value can't be stranded mid-count.
	setTimeout(() => {
		if (countRaf) cancelAnimationFrame(countRaf);
		countRaf = null;
		if (el.isConnected) el.textContent = Math.round(target).toLocaleString('en-US');
	}, dur + 40);
}

/* ---------- Supporting sections ---------- */

function supportMarkup(comps, r, ghost) {
	const shown = comps.slice(0, 4);
	const trend = state.item ? trendFor(state.item.id, state.trendRange) : { series: [100, 100], change: 0 };

	return `
		<section class="support">
			<div class="support-head"><h3>Recent market activity</h3>
				<span style="font-family:var(--font-data);font-size:10px;letter-spacing:.09em;color:var(--ink-3);">${ghost ? '&mdash;' : `${comps.length} sales &middot; ${state.size}ml`}</span>
			</div>
			<div class="comps-list">
				${ghost ? [0, 1, 2, 3].map(() => `
					<div class="comp-row">
						<span class="comp-date">&mdash;&mdash;</span>
						<span class="comp-spec">&mdash;&mdash;% full &middot; &mdash;&mdash;</span>
						<span class="comp-price">&mdash;&mdash;&mdash;</span>
					</div>`).join('')
				: shown.length ? shown.map((c) => `
					<div class="comp-row">
						<span class="comp-date">${c.date}</span>
						<span class="comp-spec"><b>${c.fill}%</b> full &middot; ${escapeHtml(c.condition)}</span>
						<span class="comp-price">${money(c.price)}</span>
					</div>`).join('')
				: `<div class="comp-row"><span class="comp-spec">No sales recorded in this size yet.</span></div>`}
			</div>
		</section>

		<section class="support">
			<div class="support-head"><h3>Market trend</h3>
				<div class="trend-toggle" id="trend-toggle" role="group" aria-label="Trend window">
					${['6M', '1Y', '3Y', 'ALL'].map((rg) => `<button type="button" data-r="${rg}" aria-pressed="${rg === state.trendRange}">${rg}</button>`).join('')}
				</div>
			</div>
			<div class="trend-body">
				<div class="trend-chart">${sparkline(trend.series)}</div>
				<div class="trend-figure">
					<span class="trend-change">${trend.change >= 0 ? '+' : '&minus;'}${Math.abs(trend.change).toFixed(1)}%</span>
					<div class="trend-caption">${state.trendRange} movement</div>
				</div>
			</div>
		</section>

		${r ? `
		<section class="support">
			<div class="support-head"><h3>What moved this estimate</h3></div>
			${r.floorBinds ? `<p class="factor-note">Split value set this price, not the factors below. The six multipliers returned <b>${money(r.streetValue)}</b>; breaking the bottle into decants beats that, so the floor took over. These are what moved the multiplier result.</p>` : ''}
			${r.factors.map((f) => {
				const pct = f.delta * 100;
				const w = Math.min(50, Math.abs(pct) * 1.3);
				return `
				<div class="factor-row">
					<div class="factor-name">${escapeHtml(f.label)}<span>${escapeHtml(f.detail)}</span></div>
					<div class="factor-bar"><i class="${pct < 0 ? 'neg' : ''}" style="${pct < 0 ? `right:50%;width:0` : `left:50%;width:0`}" data-w="${w}"></i></div>
					<div class="factor-delta ${pct < 0 ? 'neg' : ''}">${pct >= 0 ? '+' : '&minus;'}${Math.abs(pct).toFixed(1)}%</div>
				</div>`;
			}).join('')}
		</section>` : ''}`;
}

function sparkline(series) {
	const w = 100, h = 42;
	const min = Math.min(...series), max = Math.max(...series);
	const span = (max - min) || 1;
	const pts = series.map((v, i) => {
		const x = (i / (series.length - 1)) * w;
		const y = h - ((v - min) / span) * (h - 6) - 3;
		return [x, y];
	});
	const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
	// The endpoint marker lives in the DOM rather than the SVG: the chart
	// stretches to fill its column, and a circle inside a non-uniform viewBox
	// stretches with it into an ellipse.
	const endTop = ((pts[pts.length - 1][1] / h) * 100).toFixed(2);
	return `<div class="spark-wrap">
		<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Price index over ${state.trendRange}">
			<path class="spark-area" d="${d} L${w},${h} L0,${h} Z" />
			<path class="spark-line" d="${d}" vector-effect="non-scaling-stroke" />
		</svg>
		<span class="spark-dot" style="top:${endTop}%"></span>
	</div>`;
}

function wireTrend() {
	const t = $('#trend-toggle');
	if (!t) return;
	t.addEventListener('click', (e) => {
		const btn = e.target.closest('button[data-r]');
		if (!btn || btn.dataset.r === state.trendRange) return;
		state.trendRange = btn.dataset.r;
		// Only the trend section re-renders; the valuation above it is
		// unaffected by the window, so it must not flicker.
		const support = $('#support');
		support.innerHTML = supportMarkup(
			state.item ? compsFor(state.item.id, state.size) : [],
			result && !result.refused ? result : null,
			!result,
		);
		wireTrend();
		animateFactors();
	});
}

function animateFactors() {
	const bars = document.querySelectorAll('.factor-bar i[data-w]');
	if (!bars.length) return;
	const apply = () => bars.forEach((b) => { b.style.width = b.dataset.w + '%'; });
	if (reduceMotion()) { apply(); return; }
	requestAnimationFrame(() => requestAnimationFrame(apply));
	setTimeout(apply, 80);
}

/* ---------- Boot ---------- */

function init() {
	initCombo();
	initAction();
	renderProvenance();
	renderIdentity();
	renderConfig();
	renderResult();

	$('#stale-refresh').addEventListener('click', runEstimate);

	// Demo affordance: deep-link a bottle so every state is reachable directly.
	const preset = new URLSearchParams(location.search).get('item');
	if (preset) {
		const item = catalogue.find((c) => c.id === preset);
		if (item) selectItem(item);
	}

	// Catalogue comes from Supabase when it has one, so fragrances can be added
	// without a redeploy.
	loadCatalogue().then((list) => {
		if (list?.length) catalogue = list;
	});
}

init();
