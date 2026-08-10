// Shared empty, gated and error states.
//
// Every empty state here answers three things: what belongs in this space, why
// that is worth anything, and what to do next. A bare "No offers yet" answers
// none of them.
//
// Vial's payoff is price discovery: list a bottle, get an offer or a bid, find
// out what it is actually worth. So the copy below routes toward listing rather
// than toward browsing, because with no inventory browsing leads nowhere.

const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

// One stroke weight across the set, drawn rather than borrowed from a glyph font.
export const EMPTY_ICONS = {
	bottle: `<svg ${ICON_ATTRS}><path d="M10 2h4"/><path d="M11 2v3.2c0 .5-.2 1-.6 1.4L9 8c-.6.6-1 1.5-1 2.4V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9.6c0-.9-.4-1.8-1-2.4l-1.4-1.4c-.4-.4-.6-.9-.6-1.4V2"/><path d="M8 13h8"/></svg>`,
	tag: `<svg ${ICON_ATTRS}><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>`,
	message: `<svg ${ICON_ATTRS}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
	heart: `<svg ${ICON_ATTRS}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
	bag: `<svg ${ICON_ATTRS}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
	search: `<svg ${ICON_ATTRS}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
	gavel: `<svg ${ICON_ATTRS}><path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="m16 16 4-4"/><path d="m8 8 4-4"/><path d="m18.5 13.5-8-8"/><path d="M3 21h9"/></svg>`,
	lock: `<svg ${ICON_ATTRS}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
	broken: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="9"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M9 15.5c1.8-1.3 4.2-1.3 6 0"/></svg>`,
};

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

/**
 * @param {object} opts
 * @param {string} opts.icon      key of EMPTY_ICONS
 * @param {string} opts.title     what belongs in this space
 * @param {string} opts.body      why it is worth anything (plain text)
 * @param {Array}  [opts.actions] [{ label, href, variant }], first is primary
 * @param {boolean}[opts.feature] true for a page's main empty space, false for
 *                                a panel or an error, which should stay compact
 */
export function renderEmptyState({ icon, title, body, actions = [], feature = false }) {
	const buttons = actions
		.map((a, i) => {
			const variant = a.variant || (i === 0 ? 'btn-primary' : 'btn-outline');
			return `<a class="btn ${variant}" href="${a.href}">${escapeHtml(a.label)}</a>`;
		})
		.join('');

	return `
		<div class="empty-state${feature ? ' is-feature' : ''}">
			${icon && EMPTY_ICONS[icon] ? `<span class="empty-icon">${EMPTY_ICONS[icon]}</span>` : ''}
			<h2 class="empty-title">${escapeHtml(title)}</h2>
			${body ? `<p class="empty-body">${escapeHtml(body)}</p>` : ''}
			${buttons ? `<div class="empty-actions">${buttons}</div>` : ''}
		</div>
	`;
}

/**
 * Sign-in gate. Names what the visitor gets on the other side rather than just
 * demanding an account.
 */
export function renderSignedOut({ title, body }) {
	return renderEmptyState({
		icon: 'lock',
		title,
		body,
		actions: [{ label: 'Sign in or create an account', href: 'account.html' }],
		feature: true,
	});
}
