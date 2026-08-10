import { getProfile, getListingsBySeller, CONDITIONS } from './db.js';
import { renderThumbImage, renderAvatar } from './icons.js';
import { renderEmptyState } from './empty-state.js';

const root = document.getElementById('profile-root');
const params = new URLSearchParams(location.search);
const id = params.get('id');

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function conditionLabel(value) {
	return CONDITIONS.find((c) => c.value === value)?.label || value;
}

function card(listing) {
	return `
		<a class="listing-card" href="listing.html?id=${encodeURIComponent(listing.id)}">
			<div class="thumb">
				${listing.status === 'sold' ? '<span class="badge sold">Sold</span>' : ''}
				${renderThumbImage(listing.images?.[0])}
			</div>
			<div class="info">
				<div class="brand">${escapeHtml(listing.brand)}</div>
				<div class="name">${escapeHtml(listing.name)}</div>
				<div class="meta">
					<span class="chip">${listing.size_ml}ml</span>
					<span class="chip">${conditionLabel(listing.condition)}</span>
				</div>
				<div class="price">$${Number(listing.price).toFixed(0)}</div>
			</div>
		</a>
	`;
}

async function render() {
	if (!id) {
		root.innerHTML = renderEmptyState({
			icon: 'broken',
			title: 'No seller specified',
			body: 'That link is missing a seller, so there is nothing to show.',
			actions: [{ label: 'Browse bottles', href: 'browse.html' }],
			feature: true,
		});
		return;
	}
	const profile = await getProfile(id);
	if (!profile) {
		root.innerHTML = renderEmptyState({
			icon: 'broken',
			title: "That seller isn't here",
			body: 'The account may have been removed, or the link may be wrong.',
			actions: [{ label: 'Browse bottles', href: 'browse.html' }],
			feature: true,
		});
		return;
	}
	const listings = await getListingsBySeller(id);
	const active = listings.filter((l) => l.status !== 'sold');
	const sold = listings.filter((l) => l.status === 'sold');

	root.innerHTML = `
		<div class="profile-header">
			${renderAvatar(profile, 84)}
			<div>
				<h1>${escapeHtml(profile.display_name || profile.username)}</h1>
				<div class="profile-meta">@${escapeHtml(profile.username)} ${profile.location ? '· ' + escapeHtml(profile.location) : ''}</div>
				<div class="profile-stats">
					<div><b>${listings.length}</b>listings</div>
					<div><b>${sold.length}</b>sold</div>
				</div>
			</div>
		</div>
		${profile.bio ? `<p style="color:var(--ink-soft);max-width:640px;">${escapeHtml(profile.bio)}</p>` : ''}
		<hr class="divider" />
		<h3 class="section-title">Available (${active.length})</h3>
		<div class="listing-grid" style="margin-bottom:32px;">
			${active.length ? active.map(card).join('') : renderEmptyState({
				icon: 'bottle',
				title: 'Nothing available',
				body: 'This seller has no bottles up at the moment.',
			})}
		</div>
		${sold.length ? `
			<h3 class="section-title">Sold (${sold.length})</h3>
			<div class="listing-grid">${sold.map(card).join('')}</div>
		` : ''}
	`;
}

render();
