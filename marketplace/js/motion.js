// GSAP-powered entrance/scroll motion. Every function is a safe no-op if the
// GSAP CDN script didn't load (offline dev, blocked network), so the site
// never depends on it for content to be visible. Every hidden state also
// carries a hard setTimeout fallback that forces full visibility even if a
// tween stalls (throttled background tab, slow ticker, etc.). Above-the-fold
// content must never be able to get stuck invisible.

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

export function heroEntrance() {
	if (!gsapReady() || prefersReducedMotion()) return;
	const h1 = document.querySelector('.hero h1');
	if (!h1) return;
	const cta = document.querySelector('.hero-cta-row');
	const photo = document.querySelector('.hero-photo');

	const targets = [h1, cta, photo].filter(Boolean);
	gsap.set(targets, { opacity: 0, y: 26 });
	setTimeout(() => forceVisible(targets), 1800);

	const tl = gsap.timeline({ defaults: { duration: 0.8, ease: 'power3.out' } });
	tl.to(h1, { opacity: 1, y: 0 });
	if (cta) tl.to(cta, { opacity: 1, y: 0 }, '-=0.55');
	if (photo) tl.to(photo, { opacity: 1, y: 0, duration: 1 }, '-=0.5');
}

/**
 * Fades/scales elements matching `selector` up into view as they cross the
 * viewport. Safe to call repeatedly (e.g. after a filter re-render): it
 * clears out stale triggers pointing at removed DOM nodes first.
 */
export function revealOnScroll(selector, opts = {}) {
	if (!gsapReady() || !window.ScrollTrigger || prefersReducedMotion()) return;
	gsap.registerPlugin(ScrollTrigger);

	ScrollTrigger.getAll().forEach((st) => {
		if (st.trigger && !document.body.contains(st.trigger)) st.kill();
	});

	const els = gsap.utils.toArray(selector).filter((el) => !el.dataset.motionDone);
	if (!els.length) return;
	els.forEach((el) => (el.dataset.motionDone = '1'));

	gsap.set(els, { opacity: 0, y: opts.y ?? 24, scale: opts.scale ?? 0.97 });
	setTimeout(() => forceVisible(els), 2200);

	ScrollTrigger.batch(els, {
		start: 'top 92%',
		once: true,
		onEnter: (batch) =>
			gsap.to(batch, {
				opacity: 1,
				y: 0,
				scale: 1,
				duration: 0.6,
				stagger: 0.08,
				ease: 'power2.out',
				overwrite: true,
				clearProps: 'transform',
			}),
	});
	ScrollTrigger.refresh();
}
