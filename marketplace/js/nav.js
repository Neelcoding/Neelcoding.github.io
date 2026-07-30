// Shared header/footer behaviour: demo-mode banner + auth-aware header actions.
import { isSupabaseConfigured } from './supabase-client.js';
import { getCurrentUser, signOut } from './db.js';

function renderDemoBanner() {
	const el = document.getElementById('demo-banner');
	if (!el) return;
	if (isSupabaseConfigured) return;
	el.innerHTML = `<div class="demo-banner"><strong>Demo mode:</strong> Supabase isn't connected yet, so listings, accounts, and photos are stored only in this browser. See <code>marketplace/sql/schema.sql</code> and <code>marketplace/js/supabase-client.js</code> to go live.</div>`;
}

async function renderHeaderActions() {
	const el = document.getElementById('header-actions');
	if (!el) return;
	const user = await getCurrentUser();
	if (user) {
		const label = user.username || user.email || 'Account';
		el.innerHTML = `
			<a href="sell.html" class="btn btn-gold btn-sm">+ List an item</a>
			<a href="account.html" class="btn btn-ghost btn-sm">${escapeHtml(label)}</a>
		`;
	} else {
		el.innerHTML = `
			<a href="sell.html" class="btn btn-gold btn-sm">+ List an item</a>
			<a href="account.html" class="btn btn-outline btn-sm">Sign in</a>
		`;
	}
}

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}

renderDemoBanner();
renderHeaderActions();

export { renderHeaderActions };
