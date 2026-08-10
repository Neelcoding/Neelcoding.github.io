import { getCurrentUser, getConversations, getMessages, sendMessage, markConversationRead } from './db.js';
import { renderAvatar } from './icons.js';
import { renderEmptyState, renderSignedOut as renderSignedOutState } from './empty-state.js';

const root = document.getElementById('messages-root');
const params = new URLSearchParams(location.search);
const activeId = params.get('id');
let pollTimer = null;

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function otherParty(convo, userId) {
	return convo.buyer_id === userId ? convo.seller : convo.buyer;
}

function timeLabel(iso) {
	return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function renderSignedOut() {
	root.innerHTML = renderSignedOutState({
		title: 'Your conversations live here',
		body: 'Sign in to pick up threads with buyers and sellers about specific bottles.',
	});
}

async function render() {
	const user = await getCurrentUser();
	if (!user) return renderSignedOut();

	const conversations = await getConversations(user.id);

	root.innerHTML = `
		<h1 style="margin-bottom:20px;">Messages</h1>
		<div class="messages-layout">
			<div class="conversation-list" id="conversation-list">
				${conversations.length ? conversations.map((c) => conversationRow(c, user)).join('') : renderEmptyState({
						icon: 'message',
						title: 'No conversations',
						body: 'Ask a seller about a bottle before you commit and the thread starts here.',
						actions: [{ label: 'Browse bottles', href: 'browse.html' }],
					})}
			</div>
			<div class="thread-pane" id="thread-pane">
				${activeId ? '' : renderEmptyState({
					icon: 'message',
					title: 'Pick a conversation',
					body: 'Choose a thread on the left to read it and reply.',
					feature: true,
				})}
			</div>
		</div>
	`;

	if (activeId) {
		const convo = conversations.find((c) => c.id === activeId);
		if (convo) await renderThread(convo, user);
	}
}

function conversationRow(convo, user) {
	const other = otherParty(convo, user.id) || {};
	const listing = convo.listings;
	const active = convo.id === activeId;
	return `
		<a class="conversation-row ${active ? 'active' : ''}" href="messages.html?id=${encodeURIComponent(convo.id)}">
			${renderAvatar(other, 38)}
			<div style="min-width:0;">
				<div class="conversation-name">${escapeHtml(other.display_name || other.username || 'User')}</div>
				<div class="conversation-sub">${listing ? escapeHtml(`${listing.brand} ${listing.name}`) : 'General'}</div>
			</div>
		</a>
	`;
}

async function renderThread(convo, user) {
	const pane = document.getElementById('thread-pane');
	const other = otherParty(convo, user.id) || {};
	const listing = convo.listings;

	pane.innerHTML = `
		<div class="thread-header">
			${renderAvatar(other, 38)}
			<div>
				<div class="conversation-name">${escapeHtml(other.display_name || other.username || 'User')}</div>
				${listing ? `<a href="listing.html?id=${encodeURIComponent(listing.id)}" class="conversation-sub" style="text-decoration:underline;">${escapeHtml(`${listing.brand} ${listing.name}`)}</a>` : ''}
			</div>
		</div>
		<div class="thread-messages" id="thread-messages"></div>
		<form class="thread-composer" id="thread-composer">
			<input type="text" id="thread-input" placeholder="Type a message…" autocomplete="off" />
			<button type="submit" class="btn btn-primary btn-sm">Send</button>
		</form>
	`;

	await loadMessages(convo.id, user.id);
	await markConversationRead({ conversationId: convo.id, isBuyer: convo.buyer_id === user.id });
	document.dispatchEvent(new CustomEvent('fm:counts-changed'));

	document.getElementById('thread-composer').addEventListener('submit', async (e) => {
		e.preventDefault();
		const input = document.getElementById('thread-input');
		const body = input.value.trim();
		if (!body) return;
		input.value = '';
		await sendMessage({ conversationId: convo.id, senderId: user.id, body });
		await loadMessages(convo.id, user.id);
	});

	clearInterval(pollTimer);
	pollTimer = setInterval(async () => {
		await loadMessages(convo.id, user.id);
		await markConversationRead({ conversationId: convo.id, isBuyer: convo.buyer_id === user.id });
		document.dispatchEvent(new CustomEvent('fm:counts-changed'));
	}, 5000);
	window.addEventListener('beforeunload', () => clearInterval(pollTimer));
}

async function loadMessages(conversationId, userId) {
	const list = document.getElementById('thread-messages');
	if (!list) return;
	const messages = await getMessages(conversationId);
	const wasAtBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 20;
	list.innerHTML = messages.map((m) => `
		<div class="thread-bubble-row ${m.sender_id === userId ? 'mine' : ''}">
			<div class="thread-bubble">${escapeHtml(m.body)}</div>
			<div class="thread-time">${timeLabel(m.created_at)}</div>
		</div>
	`).join('');
	if (wasAtBottom || !list.dataset.scrolled) {
		list.scrollTop = list.scrollHeight;
		list.dataset.scrolled = 'true';
	}
}

render();
