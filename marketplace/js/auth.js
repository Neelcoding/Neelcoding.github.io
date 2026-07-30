import { isSupabaseConfigured } from './supabase-client.js';
import {
	getCurrentUser,
	getProfile,
	updateProfile,
	getListingsBySeller,
	signIn,
	signUp,
	signOut,
} from './db.js';

const root = document.getElementById('account-root');

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function renderAuthForms() {
	root.innerHTML = `
		<div class="card-panel">
			<h2 style="margin-top:0;">Sign in</h2>
			<div id="form-msg"></div>
			<form id="login-form">
				<div class="form-row">
					<label>Email</label>
					<input type="email" id="login-email" required />
				</div>
				<div class="form-row">
					<label>Password</label>
					<input type="password" id="login-password" required minlength="6" />
				</div>
				<button class="btn btn-primary btn-block" type="submit">Sign in</button>
			</form>
			<div class="auth-toggle">New to Vial? <a id="show-signup">Create an account</a></div>
		</div>
	`;

	document.getElementById('show-signup').addEventListener('click', renderSignupForm);
	document.getElementById('login-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const email = document.getElementById('login-email').value.trim();
		const password = document.getElementById('login-password').value;
		try {
			await signIn({ email, password });
			renderAccount();
		} catch (err) {
			showMsg(err.message || 'Could not sign in.', 'error');
		}
	});

	if (!isSupabaseConfigured) {
		showMsg('Demo mode: any email/password combo signs you in — no real account is created.', 'success');
	}
}

function renderSignupForm() {
	root.innerHTML = `
		<div class="card-panel">
			<h2 style="margin-top:0;">Create your account</h2>
			<div id="form-msg"></div>
			<form id="signup-form">
				<div class="form-row">
					<label>Username</label>
					<input type="text" id="signup-username" required />
				</div>
				<div class="form-row">
					<label>Email</label>
					<input type="email" id="signup-email" required />
				</div>
				<div class="form-row">
					<label>Password</label>
					<input type="password" id="signup-password" required minlength="6" />
				</div>
				<button class="btn btn-primary btn-block" type="submit">Create account</button>
			</form>
			<div class="auth-toggle">Already have an account? <a id="show-login">Sign in</a></div>
		</div>
	`;
	document.getElementById('show-login').addEventListener('click', renderAuthForms);
	document.getElementById('signup-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const username = document.getElementById('signup-username').value.trim();
		const email = document.getElementById('signup-email').value.trim();
		const password = document.getElementById('signup-password').value;
		try {
			await signUp({ email, password, username });
			renderAccount();
		} catch (err) {
			showMsg(err.message || 'Could not create account.', 'error');
		}
	});
}

function showMsg(text, type) {
	const el = document.getElementById('form-msg');
	if (el) el.innerHTML = `<div class="form-msg ${type}">${escapeHtml(text)}</div>`;
}

async function renderAccount() {
	const user = await getCurrentUser();
	if (!user) return renderAuthForms();

	const profile = (await getProfile(user.id)) || { username: user.username, display_name: '', location: '', bio: '' };
	const listings = await getListingsBySeller(user.id);

	root.innerHTML = `
		<div class="card-panel" style="margin-bottom:24px;">
			<h2 style="margin-top:0;">Your profile</h2>
			<div id="form-msg"></div>
			<form id="profile-form">
				<div class="form-grid-2">
					<div class="form-row">
						<label>Display name</label>
						<input type="text" id="p-display" value="${escapeHtml(profile.display_name || '')}" />
					</div>
					<div class="form-row">
						<label>Location</label>
						<input type="text" id="p-location" value="${escapeHtml(profile.location || '')}" placeholder="City, State" />
					</div>
				</div>
				<div class="form-row">
					<label>Bio</label>
					<textarea id="p-bio" placeholder="Tell buyers about your collection, shipping, etc.">${escapeHtml(profile.bio || '')}</textarea>
				</div>
				<button class="btn btn-primary" type="submit">Save profile</button>
				<a href="profile.html?id=${encodeURIComponent(user.id)}" class="btn btn-outline">View public profile</a>
			</form>
		</div>

		<div class="card-panel" style="margin-bottom:24px;">
			<div style="display:flex;align-items:center;justify-content:space-between;">
				<h2 style="margin:0;">Your listings (${listings.length})</h2>
				<a href="sell.html" class="btn btn-gold btn-sm">+ New listing</a>
			</div>
			<hr class="divider" />
			${listings.length ? listings.map(myListingRow).join('') : `<p style="color:var(--ink-soft);">You haven't listed anything yet.</p>`}
		</div>

		<button class="btn btn-outline" id="signout-btn">Sign out</button>
	`;

	document.getElementById('profile-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		try {
			await updateProfile(user.id, {
				display_name: document.getElementById('p-display').value.trim(),
				location: document.getElementById('p-location').value.trim(),
				bio: document.getElementById('p-bio').value.trim(),
			});
			showMsg('Profile saved.', 'success');
		} catch (err) {
			showMsg(err.message || 'Could not save profile.', 'error');
		}
	});

	document.getElementById('signout-btn').addEventListener('click', async () => {
		await signOut();
		location.reload();
	});
}

function myListingRow(listing) {
	return `
		<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);">
			<a href="listing.html?id=${encodeURIComponent(listing.id)}" style="font-weight:600;">
				${escapeHtml(listing.brand)} ${escapeHtml(listing.name)}
			</a>
			<span class="chip">${listing.status === 'sold' ? 'Sold' : 'Available'} · $${Number(listing.price).toFixed(0)}</span>
		</div>
	`;
}

renderAccount();
