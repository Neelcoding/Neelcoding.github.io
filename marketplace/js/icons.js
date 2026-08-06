// Inline SVG icons instead of emoji, so they render consistently across platforms.

export const ICON_SEARCH = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

export function iconHeart(filled) {
	return `<svg viewBox="0 0 24 24" width="18" height="18" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

export const ICON_BAG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;

export const ICON_MESSAGE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

export const ICON_BOTTLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><path d="M11 2v3.2c0 .5-.2 1-.6 1.4L9 8c-.6.6-1 1.5-1 2.4V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9.6c0-.9-.4-1.8-1-2.4l-1.4-1.4c-.4-.4-.6-.9-.6-1.4V2"/><path d="M8 13h8"/></svg>`;

export function renderThumbImage(img) {
	if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'))) {
		return `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
	}
	return `<span class="thumb-icon">${ICON_BOTTLE}</span>`;
}

export function renderAvatar(profile, size = 46) {
	const name = (profile?.display_name || profile?.username || '?').trim();
	const initial = (name.slice(0, 1) || '?').toUpperCase();
	const fontSize = Math.round(size * 0.4);
	if (profile?.avatar_url) {
		return `<img src="${profile.avatar_url}" alt="" class="avatar" style="width:${size}px;height:${size}px;font-size:${fontSize}px;object-fit:cover;" />`;
	}
	return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">${initial}</span>`;
}
