// Shared header/footer behaviour: demo-mode banner + auth-aware header actions.
import { isSupabaseConfigured } from './supabase-client.js';
import { getCurrentUser, getProfile, getUnreadConversationCount, signOut } from './db.js';
import { iconHeart, ICON_BAG, ICON_MESSAGE, renderAvatar } from './icons.js';
import { getLikedIds, getBagIds } from './wishlist.js';
import { heroEntrance } from './motion.js';

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
	const likedCount = getLikedIds().length;
	const bagCount = getBagIds().length;
	const profile = user ? await getProfile(user.id) : null;
	const unreadCount = user ? await getUnreadConversationCount(user.id) : 0;
	const displayName = profile?.display_name || profile?.username || user?.username || user?.email || 'Account';

	el.innerHTML = `
		<a href="sell.html" class="btn btn-gold btn-sm"><span class="label-full">+ List an item</span><span class="label-short">+ Sell</span></a>
		<a href="index.html?view=liked" class="icon-link" aria-label="Liked items" title="Liked">
			${iconHeart(false)}${likedCount ? `<span class="icon-count">${likedCount}</span>` : ''}
		</a>
		<a href="index.html?view=bag" class="icon-link" aria-label="Bag" title="Bag">
			${ICON_BAG}${bagCount ? `<span class="icon-count">${bagCount}</span>` : ''}
		</a>
		${user ? `
			<a href="messages.html" class="icon-link" aria-label="Messages" title="Messages">
				${ICON_MESSAGE}${unreadCount ? `<span class="icon-count">${unreadCount}</span>` : ''}
			</a>
			<div class="account-menu" id="account-menu">
				<button class="account-avatar-btn" id="account-avatar-btn" aria-label="Account menu">
					${renderAvatar(profile || { display_name: displayName }, 34)}
				</button>
				<div class="account-dropdown" id="account-dropdown">
					<div class="account-dropdown-header">Signed in as<br /><strong>${escapeHtml(displayName)}</strong></div>
					<a href="profile.html?id=${encodeURIComponent(user.id)}">View public profile</a>
					<a href="account.html">Account settings</a>
					<a href="my-listings.html">My listings</a>
					<a href="offers.html">Offers received</a>
					<a href="messages.html">Messages</a>
					<div class="account-dropdown-divider"></div>
					<button id="account-logout">Log out</button>
				</div>
			</div>
		` : `<a href="account.html" class="btn btn-outline btn-sm">Sign up</a>`}
	`;

	wireAccountMenu();
}

function wireAccountMenu() {
	const btn = document.getElementById('account-avatar-btn');
	const dropdown = document.getElementById('account-dropdown');
	if (!btn || !dropdown) return;
	btn.addEventListener('click', (e) => {
		e.stopPropagation();
		dropdown.classList.toggle('open');
	});
	document.getElementById('account-logout')?.addEventListener('click', async () => {
		await signOut();
		location.href = 'index.html';
	});
}

document.addEventListener('click', (e) => {
	const menu = document.getElementById('account-menu');
	const dropdown = document.getElementById('account-dropdown');
	if (!menu || !dropdown || !dropdown.classList.contains('open')) return;
	if (!menu.contains(e.target)) dropdown.classList.remove('open');
});

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}

function wireHeaderSearch() {
	const form = document.getElementById('header-search-form');
	if (!form) return;
	const isBrowsePage = !!document.getElementById('listing-grid');
	if (isBrowsePage) return; // browse.js owns submit handling on the browse page itself
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const q = document.getElementById('header-search-input').value.trim();
		location.href = 'index.html' + (q ? `?q=${encodeURIComponent(q)}` : '');
	});
}

renderDemoBanner();
renderHeaderActions();
wireHeaderSearch();
heroEntrance();
document.addEventListener('fm:counts-changed', renderHeaderActions);

export { renderHeaderActions };
