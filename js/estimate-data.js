// Mock catalogue and valuation model for the Assay estimator.
//
// Everything here is fabricated. Street prices, comps and trends are invented
// to exercise every UI state; nothing hits a network. The model itself is a
// compact implementation of assay/PRICING-MODEL.md — regime branching, the
// six multipliers, and the split floor — kept short because the point of this
// module is to make the interface demonstrably coherent, not to be right.

/* ---------- Regimes ----------
   A: in production, heavily discounted. Street sits far under MSRP.
   B: in production, little discounting. Street is close to MSRP.
   C: discontinued or reformulated. No street anchor; comps only. */

export const REGIMES = {
	A: { code: 'A', label: 'Discounted designer', anchor: 'Street price', opened: 0.78 },
	B: { code: 'B', label: 'Niche, no discount', anchor: 'Street price', opened: 0.85 },
	C: { code: 'C', label: 'Discontinued', anchor: 'Comparable sales', opened: 0.90 },
};

export const CATALOGUE = [
	{
		id: 'aventus',
		name: 'Aventus',
		house: 'Creed',
		released: 2010,
		family: 'Fruity chypre',
		regime: 'B',
		msrp: { 50: 445, 100: 595, 120: 745 },
		street: { 50: 398, 100: 520, 120: 645 },
		sizes: [50, 100, 120],
		defaultSize: 100,
	},
	{
		id: 'baccarat-540',
		name: 'Baccarat Rouge 540',
		house: 'Maison Francis Kurkdjian',
		released: 2015,
		family: 'Amber floral',
		regime: 'B',
		msrp: { 70: 325, 200: 555 },
		street: { 70: 300, 200: 520 },
		sizes: [70, 200],
		defaultSize: 70,
	},
	{
		id: 'sauvage-edp',
		name: 'Sauvage Eau de Parfum',
		house: 'Dior',
		released: 2018,
		family: 'Aromatic fougère',
		regime: 'A',
		msrp: { 60: 125, 100: 175 },
		street: { 60: 78, 100: 108 },
		sizes: [60, 100],
		defaultSize: 100,
	},
	{
		id: 'bleu-de-chanel',
		name: 'Bleu de Chanel Parfum',
		house: 'Chanel',
		released: 2018,
		family: 'Woody aromatic',
		regime: 'A',
		msrp: { 50: 132, 100: 180 },
		street: { 50: 96, 100: 134 },
		sizes: [50, 100],
		defaultSize: 100,
	},
	{
		id: 'oud-wood',
		name: 'Oud Wood',
		house: 'Tom Ford',
		released: 2007,
		family: 'Woody oriental',
		regime: 'B',
		msrp: { 50: 295, 100: 420 },
		street: { 50: 248, 100: 356 },
		sizes: [50, 100],
		defaultSize: 50,
	},
	{
		id: 'mitsouko-vintage',
		name: 'Mitsouko (pre-2013 formula)',
		house: 'Guerlain',
		released: 1919,
		family: 'Chypre',
		regime: 'C',
		msrp: { 75: 168 },
		street: { 75: null },
		sizes: [75],
		defaultSize: 75,
		compMedian: { 75: 340 },
	},
	{
		id: 'kouros-vintage',
		name: 'Kouros (vintage splash)',
		house: 'Yves Saint Laurent',
		released: 1981,
		family: 'Aromatic fougère',
		regime: 'C',
		msrp: { 100: 96 },
		street: { 100: null },
		sizes: [100],
		defaultSize: 100,
		compMedian: { 100: 210 },
	},
	{
		id: 'layton',
		name: 'Layton',
		house: 'Parfums de Marly',
		released: 2016,
		family: 'Amber vanilla',
		regime: 'B',
		msrp: { 125: 355 },
		street: { 125: 315 },
		sizes: [125],
		defaultSize: 125,
	},
];

/* ---------- Model parameters ----------
   Starting priors from the pricing doc, not measured values. opened_factor is
   the load-bearing guess: everything else scales off it. */

export const CONDITIONS = [
	{ id: 'mint', label: 'Mint', detail: 'No wear, sprays clean', factor: 1.0 },
	{ id: 'light', label: 'Light wear', detail: 'Minor scuffs on glass or cap', factor: 0.96 },
	{ id: 'marked', label: 'Marked', detail: 'Label lifting, visible damage', factor: 0.88 },
	{ id: 'faulty', label: 'Faulty atomiser', detail: 'Does not spray reliably', factor: 0.75 },
];

/* Answers to "original box", not descriptions of what is being sold.
   The previous wording was "Box & papers / Box only / Bottle only", which read
   as a choice between selling the box and selling the bottle. Every option
   includes the bottle; the only variable is whether the carton survived. */
export const COMPLETENESS = [
	{ id: 'full', label: 'Included', factor: 1.0 },
	{ id: 'box', label: 'Damaged', factor: 0.97 },
	{ id: 'bare', label: 'Missing', factor: 0.93 },
];

/** Decant premium over street per-ml. Scales inversely with affordability:
    nobody decants a $40 bottle, everybody decants a $400 one.

    These are lower than the first draft in assay/PRICING-MODEL.md. At 1.8x /
    2.5x the floor came out above street per-ml once the 0.9 and 0.55 haircuts
    were applied, which valued an 80%-full Aventus at $515 against a $520
    sealed bottle. A partial can approach street per-ml on desirable juice; it
    cannot exceed it. */
function decantPremium(streetPrice) {
	if (streetPrice < 80) return 1.0;
	if (streetPrice < 200) return 1.25;
	if (streetPrice < 500) return 1.5;
	return 1.8;
}

function ageFactor(batchYear, thisYear) {
	const age = thisYear - batchYear;
	if (age < 2) return 1.0;
	if (age < 5) return 0.97;
	if (age < 10) return 0.93;
	return 0.88;
}

/** Ownership duration is derived from purchase year, never asked for twice.
    It stands in for storage risk when a batch code isn't available. */
function storageFactor(ownedYears) {
	return ownedYears > 5 ? 0.95 : 1.0;
}

export const THIS_YEAR = 2026;

/**
 * Runs the pricing model over a configuration.
 * Returns the value, the bounds, the factors that moved it, and whether the
 * split floor took over — which is the interesting case the UI should show.
 */
export function estimate(config) {
	const { item, size, fill, condition, completeness, batchYear, purchaseYear } = config;
	const regime = REGIMES[item.regime];
	const cond = CONDITIONS.find((c) => c.id === condition) || CONDITIONS[0];
	const comp = COMPLETENESS.find((c) => c.id === completeness) || COMPLETENESS[0];

	const ownedYears = Math.max(0, THIS_YEAR - purchaseYear);
	const fAge = ageFactor(batchYear, THIS_YEAR);
	const fStorage = storageFactor(ownedYears);
	const fill01 = fill / 100;

	let anchor;
	let anchorLabel;
	let value;
	let floorBinds = false;
	let splitFloor = 0;
	// What the six multipliers alone returned, kept so the UI can be honest
	// about which branch actually set the price.
	let streetValue = 0;

	if (item.regime === 'C') {
		// No street price exists. Comps carry it, and age reads as provenance
		// rather than decay, so the age penalty is deliberately not applied.
		anchor = item.compMedian?.[size] ?? 0;
		anchorLabel = 'Comp median';
		value = anchor * regime.opened * (0.55 + 0.45 * fill01) * cond.factor * comp.factor;
	} else {
		anchor = streetFor(item, size);
		// A fragrance with no street price in either source cannot be anchored,
		// and guessing one would be worse than declining.
		if (!anchor) {
			return {
				value: 0, low: 0, high: 0, confidence: 'Low', compCount: compsFor(item.id, size).length,
				regime, anchor: 0, anchorLabel: 'Street price', floorBinds: false, splitFloor: 0,
				streetValue: 0, ownedYears: Math.max(0, THIS_YEAR - purchaseYear), factors: [],
				refused: true,
			};
		}
		anchorLabel = 'Street price';
		value = anchor * regime.opened * fill01 * cond.factor * comp.factor * fAge * fStorage;
		// Six multipliers stack fast. Below 0.45x street the split floor should
		// be carrying the price anyway, so the model stops compounding there.
		value = Math.max(value, anchor * 0.45 * fill01);

		const mlRemaining = size * fill01;
		const perMl = anchor / size;
		splitFloor = mlRemaining * perMl * decantPremium(anchor) * 0.9 * 0.55;
		// A used bottle can never be worth more than the same volume bought new
		// and sealed. Without this the floor is free to overtake its own anchor.
		splitFloor = Math.min(splitFloor, anchor * fill01 * 0.95);
		streetValue = value;
		if (splitFloor > value) {
			value = splitFloor;
			floorBinds = true;
		}
	}

	const compCount = compsFor(item.id, size).length;
	const band = compCount >= 8 ? 0.12 : compCount >= 3 ? 0.22 : 0.35;
	const confidence = compCount >= 8 ? 'High' : compCount >= 3 ? 'Medium' : 'Low';

	// Factors are reported as their deviation from neutral, so a reader can see
	// which choices actually moved the number and by how much.
	const factors = [
		{ label: 'Fill level', delta: fill01 - 1, detail: `${fill}% of ${size}ml remaining` },
		{ label: 'Condition', delta: cond.factor - 1, detail: cond.label },
		{ label: 'Original box', delta: comp.factor - 1, detail: comp.label },
		{ label: 'Batch age', delta: item.regime === 'C' ? 0 : fAge - 1, detail: `${THIS_YEAR - batchYear} years old` },
		{ label: 'Storage', delta: item.regime === 'C' ? 0 : fStorage - 1, detail: `Owned ${ownedYears} ${ownedYears === 1 ? 'year' : 'years'}` },
	].filter((f) => Math.abs(f.delta) > 0.0005)
		.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

	return {
		value: Math.round(value),
		low: Math.round(value * (1 - band)),
		high: Math.round(value * (1 + band)),
		confidence,
		compCount,
		regime,
		anchor,
		anchorLabel,
		floorBinds,
		splitFloor: Math.round(splitFloor),
		streetValue: Math.round(streetValue),
		ownedYears,
		factors,
		// Refuse rather than guess: regime C with almost no comps has no
		// defensible number, and a confident wrong one is worse than none.
		refused: item.regime === 'C' && compCount < 3,
	};
}

/* ---------- Comparable sales ---------- */

const COMPS = {
	aventus: [
		{ date: '12 Jul', fill: 82, condition: 'Mint', price: 372, size: 100 },
		{ date: '28 Jun', fill: 64, condition: 'Light wear', price: 291, size: 100 },
		{ date: '19 Jun', fill: 95, condition: 'Mint', price: 428, size: 100 },
		{ date: '02 Jun', fill: 71, condition: 'Mint', price: 330, size: 100 },
		{ date: '24 May', fill: 55, condition: 'Light wear', price: 258, size: 100 },
		{ date: '11 May', fill: 88, condition: 'Mint', price: 402, size: 100 },
		{ date: '30 Apr', fill: 40, condition: 'Marked', price: 196, size: 100 },
		{ date: '18 Apr', fill: 77, condition: 'Mint', price: 351, size: 100 },
		{ date: '05 Apr', fill: 90, condition: 'Mint', price: 318, size: 50 },
		{ date: '21 Mar', fill: 68, condition: 'Light wear', price: 244, size: 50 },
		{ date: '09 Mar', fill: 83, condition: 'Mint', price: 289, size: 50 },
		{ date: '02 Jul', fill: 86, condition: 'Mint', price: 494, size: 120 },
		{ date: '14 Jun', fill: 72, condition: 'Light wear', price: 402, size: 120 },
		{ date: '27 Apr', fill: 91, condition: 'Mint', price: 528, size: 120 },
	],
	'baccarat-540': [
		{ date: '09 Jul', fill: 76, condition: 'Mint', price: 214, size: 70 },
		{ date: '25 Jun', fill: 91, condition: 'Mint', price: 262, size: 70 },
		{ date: '14 Jun', fill: 58, condition: 'Light wear', price: 168, size: 70 },
		{ date: '31 May', fill: 84, condition: 'Mint', price: 238, size: 70 },
		{ date: '17 May', fill: 45, condition: 'Light wear', price: 139, size: 70 },
		{ date: '03 May', fill: 88, condition: 'Mint', price: 251, size: 70 },
		{ date: '20 Apr', fill: 70, condition: 'Marked', price: 181, size: 70 },
		{ date: '06 Apr', fill: 80, condition: 'Mint', price: 226, size: 70 },
		{ date: '22 Mar', fill: 62, condition: 'Mint', price: 358, size: 200 },
		{ date: '08 Mar', fill: 85, condition: 'Mint', price: 462, size: 200 },
	],
	'sauvage-edp': [
		{ date: '14 Jul', fill: 85, condition: 'Mint', price: 68, size: 100 },
		{ date: '01 Jul', fill: 60, condition: 'Light wear', price: 49, size: 100 },
		{ date: '16 Jun', fill: 92, condition: 'Mint', price: 74, size: 100 },
		{ date: '29 May', fill: 73, condition: 'Mint', price: 58, size: 100 },
		{ date: '12 May', fill: 44, condition: 'Marked', price: 33, size: 100 },
		{ date: '27 Apr', fill: 81, condition: 'Light wear', price: 62, size: 100 },
		{ date: '10 Apr', fill: 95, condition: 'Mint', price: 78, size: 100 },
		{ date: '26 Mar', fill: 67, condition: 'Mint', price: 53, size: 100 },
		{ date: '11 Mar', fill: 78, condition: 'Mint', price: 41, size: 60 },
	],
	'bleu-de-chanel': [
		{ date: '10 Jul', fill: 88, condition: 'Mint', price: 89, size: 100 },
		{ date: '22 Jun', fill: 65, condition: 'Light wear', price: 64, size: 100 },
		{ date: '07 Jun', fill: 94, condition: 'Mint', price: 97, size: 100 },
		{ date: '19 May', fill: 72, condition: 'Mint', price: 73, size: 100 },
		{ date: '04 May', fill: 50, condition: 'Light wear', price: 48, size: 100 },
		{ date: '18 Apr', fill: 83, condition: 'Mint', price: 84, size: 100 },
		{ date: '02 Apr', fill: 90, condition: 'Mint', price: 61, size: 50 },
		{ date: '15 Mar', fill: 76, condition: 'Mint', price: 52, size: 50 },
	],
	'oud-wood': [
		{ date: '11 Jul', fill: 80, condition: 'Mint', price: 172, size: 50 },
		{ date: '26 Jun', fill: 62, condition: 'Light wear', price: 134, size: 50 },
		{ date: '09 Jun', fill: 93, condition: 'Mint', price: 201, size: 50 },
		{ date: '21 May', fill: 74, condition: 'Mint', price: 158, size: 50 },
		{ date: '06 May', fill: 48, condition: 'Marked', price: 102, size: 50 },
		{ date: '19 Apr', fill: 86, condition: 'Mint', price: 186, size: 50 },
		{ date: '03 Apr', fill: 70, condition: 'Mint', price: 218, size: 100 },
	],
	'mitsouko-vintage': [
		{ date: '02 Jul', fill: 78, condition: 'Mint', price: 312, size: 75 },
		{ date: '15 Jun', fill: 90, condition: 'Light wear', price: 368, size: 75 },
		{ date: '28 Apr', fill: 65, condition: 'Marked', price: 244, size: 75 },
		{ date: '12 Mar', fill: 84, condition: 'Mint', price: 341, size: 75 },
	],
	'kouros-vintage': [
		{ date: '20 Jun', fill: 88, condition: 'Mint', price: 226, size: 100 },
		{ date: '14 Apr', fill: 72, condition: 'Light wear', price: 178, size: 100 },
	],
	layton: [
		{ date: '13 Jul', fill: 84, condition: 'Mint', price: 208, size: 125 },
		{ date: '30 Jun', fill: 66, condition: 'Light wear', price: 162, size: 125 },
		{ date: '12 Jun', fill: 92, condition: 'Mint', price: 231, size: 125 },
		{ date: '25 May', fill: 75, condition: 'Mint', price: 188, size: 125 },
		{ date: '08 May', fill: 55, condition: 'Marked', price: 128, size: 125 },
	],
};

/* ---------- Live overlay ----------
   Populated by estimate-source.js when Supabase has real observations for a
   fragrance. Registered per fragrance rather than globally, so coverage can
   arrive unevenly without the page needing a cutover. */

const LIVE = new Map();

export function setLive(slug, payload) {
	LIVE.set(slug, payload);
}

export function isLive(slug) {
	return LIVE.has(slug);
}

/** Real observations when they exist for this fragrance, mock otherwise. */
export function compsFor(itemId, size) {
	const live = LIVE.get(itemId);
	const rows = live ? live.comps : COMPS[itemId] || [];
	return rows.filter((c) => c.size === size);
}

/** Street price, preferring a live median over the bundled figure. */
export function streetFor(item, size) {
	const live = LIVE.get(item.id);
	if (live && live.street[size] != null) return live.street[size];
	return item.street?.[size] ?? null;
}

/** How much of what is on screen is real. Drives the provenance line. */
export function provenance(slug) {
	const live = LIVE.get(slug);
	if (!live) return { live: false, comps: 0, sold: 0 };
	return { live: true, comps: live.comps.length, sold: live.soldCount || 0 };
}

/* ---------- Market trend ----------
   Index values, not dollars. Rendered as a sparkline; the percentage shown is
   first-to-last over the selected window. */

const TREND_SHAPES = {
	aventus: [100, 103, 101, 106, 109, 107, 112, 110, 115, 118, 116, 121],
	'baccarat-540': [100, 98, 96, 97, 94, 92, 93, 90, 89, 91, 88, 86],
	'sauvage-edp': [100, 101, 100, 102, 101, 103, 102, 104, 103, 105, 104, 106],
	'bleu-de-chanel': [100, 99, 101, 100, 102, 104, 103, 105, 107, 106, 108, 110],
	'oud-wood': [100, 102, 105, 104, 108, 111, 109, 113, 116, 114, 118, 122],
	'mitsouko-vintage': [100, 105, 112, 118, 124, 133, 141, 148, 158, 167, 179, 192],
	'kouros-vintage': [100, 104, 109, 115, 119, 127, 134, 140, 149, 155, 164, 171],
	layton: [100, 101, 103, 102, 105, 104, 106, 108, 107, 109, 111, 110],
};

const RANGE_POINTS = { '6M': 6, '1Y': 12, '3Y': 12, ALL: 12 };

export function trendFor(itemId, range = '1Y') {
	const base = TREND_SHAPES[itemId] || TREND_SHAPES.aventus;
	const n = RANGE_POINTS[range] || 12;
	let series = base.slice(base.length - n);
	// Longer windows exaggerate the same shape rather than inventing new data.
	if (range === '3Y') series = series.map((v, i) => 100 + (v - 100) * (1.9 - i * 0.02));
	if (range === 'ALL') series = series.map((v, i) => 100 + (v - 100) * (2.8 - i * 0.04));
	const change = ((series[series.length - 1] - series[0]) / series[0]) * 100;
	return { series, change };
}
