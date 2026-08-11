// Motion for the Perfumer's Organ system.
//
// The grammar is measurement, so the motion is too: rules draw along their
// length, gauges fill from empty to their reading, and images settle from a
// fraction over scale. One easing throughout, no overshoot, nothing loops.
//
// Everything is a no-op when GSAP is absent or the visitor asked for reduced
// motion, and every hidden state carries a hard timeout that forces visibility
// so content can never be stranded by a stalled tween.

const EASE = 'power2.out';

function gsapReady() {
	return typeof window !== 'undefined' && window.gsap;
}

function prefersReducedMotion() {
	return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function forceVisible(targets) {
	if (!gsapReady()) return;
	gsap.set(targets, { clearProps: 'opacity,transform' });
}

/** Reads the declared fill percentage off the gauge's own inline custom property. */
function declaredFill(gaugeEl) {
	const raw = gaugeEl.style.getPropertyValue('--fill').trim();
	return raw || '0%';
}

/**
 * Gauges fill from empty to their reading. This is the one signature moment:
 * the site's only chroma arriving as a measurement being taken.
 */
export function fillGauges(root = document) {
	const gauges = [...root.querySelectorAll('.fill-gauge, .card-gauge')].filter((g) => !g.dataset.filled);
	if (!gauges.length) return;
	gauges.forEach((g) => (g.dataset.filled = '1'));

	if (!gsapReady() || prefersReducedMotion()) return;

	gauges.forEach((gauge) => {
		const level = gauge.querySelector('.fill-gauge-level, span');
		if (!level) return;
		const target = declaredFill(gauge);
		const vertical = gauge.classList.contains('fill-gauge');
		const prop = vertical ? 'height' : 'width';
		gsap.fromTo(
			level,
			{ [prop]: '0%' },
			{
				[prop]: target,
				duration: 1.1,
				ease: EASE,
				scrollTrigger: window.ScrollTrigger
					? { trigger: gauge, start: 'top 92%', once: true }
					: undefined,
			},
		);
	});
}

export function heroEntrance() {
	if (!gsapReady() || prefersReducedMotion()) {
		fillGauges();
		return;
	}
	const title = document.querySelector('.hero-title');
	if (!title) {
		fillGauges();
		return;
	}
	const lede = document.querySelector('.hero-lede');
	const actions = document.querySelector('.hero-actions');
	const rows = [...document.querySelectorAll('.formula-row')];
	const specimen = document.querySelector('.specimen-hero .specimen-frame');
	const caption = document.querySelector('.specimen-hero .specimen-caption');

	const fading = [title, lede, actions, caption, ...rows].filter(Boolean);
	gsap.set(fading, { opacity: 0, y: 14 });
	if (specimen) gsap.set(specimen, { opacity: 0, scale: 1.02 });
	setTimeout(() => forceVisible([...fading, specimen].filter(Boolean)), 2200);

	const tl = gsap.timeline({ defaults: { ease: EASE } });
	tl.to(title, { opacity: 1, y: 0, duration: 0.55 });
	if (specimen) {
		// The image settles rather than arrives: a slower move, started early so
		// it reads as one composition with the headline.
		tl.to(specimen, { opacity: 1, scale: 1, duration: 0.8 }, 0.08);
	}
	if (lede) tl.to(lede, { opacity: 1, y: 0, duration: 0.5 }, '-=0.62');
	if (actions) tl.to(actions, { opacity: 1, y: 0, duration: 0.5 }, '-=0.42');
	if (caption) tl.to(caption, { opacity: 1, y: 0, duration: 0.45 }, '-=0.42');
	// Formula rows come in as a short cascade, like a column being read down.
	if (rows.length) tl.to(rows, { opacity: 1, y: 0, duration: 0.4, stagger: 0.045 }, '-=0.35');

	tl.add(() => fillGauges(), '-=0.5');
}

/**
 * Section reveals. Deliberately sparse: section headings draw their rule and
 * their content lifts once. Individual paragraphs and icons are left alone.
 */
export function revealOnScroll(selector, opts = {}) {
	if (!gsapReady() || !window.ScrollTrigger || prefersReducedMotion()) {
		fillGauges();
		return;
	}
	gsap.registerPlugin(ScrollTrigger);

	ScrollTrigger.getAll().forEach((st) => {
		if (st.trigger && !document.body.contains(st.trigger)) st.kill();
	});

	const els = gsap.utils.toArray(selector).filter((el) => !el.dataset.motionDone);
	if (!els.length) {
		fillGauges();
		return;
	}
	els.forEach((el) => (el.dataset.motionDone = '1'));

	gsap.set(els, { opacity: 0, y: opts.y ?? 12 });
	setTimeout(() => forceVisible(els), 2400);

	ScrollTrigger.batch(els, {
		start: 'top 90%',
		once: true,
		onEnter: (batch) =>
			gsap.to(batch, {
				opacity: 1,
				y: 0,
				duration: 0.5,
				stagger: 0.06,
				ease: EASE,
				overwrite: true,
				clearProps: 'transform',
				onComplete: () => fillGauges(),
			}),
	});
	ScrollTrigger.refresh();
}

/**
 * Section heading rules draw along their length as they arrive. Uses an
 * IntersectionObserver and a class rather than GSAP, so it costs nothing and
 * degrades to a plain static rule.
 */
export function drawRules() {
	if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
	const heads = [...document.querySelectorAll('.section-head')];
	if (!heads.length) return;
	heads.forEach((h) => h.classList.add('rule-pending'));
	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((e) => {
				if (!e.isIntersecting) return;
				e.target.classList.add('rule-drawn');
				io.unobserve(e.target);
			});
		},
		{ rootMargin: '0px 0px -12% 0px' },
	);
	heads.forEach((h) => io.observe(h));
}
