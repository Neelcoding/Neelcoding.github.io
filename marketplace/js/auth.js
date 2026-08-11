import { isSupabaseConfigured } from './supabase-client.js';
import {
	getCurrentUser,
	getProfile,
	updateProfile,
	uploadAvatar,
	signIn,
	signUp,
	signOut,
} from './db.js';
import { renderAvatar } from './icons.js';
import { openAvatarCropper } from './avatar-cropper.js';

const root = document.getElementById('account-root');

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str ?? '';
	return div.innerHTML;
}

function renderAuthForms() {
	root.innerHTML = `
		<div class="card-panel">
			<h1 style="margin-top:0;">Sign in</h1>
			<div id="form-msg"></div>
			<form id="login-form">
				<div class="form-row">
					<label for="login-email">Email</label>
					<input type="email" id="login-email" required />
				</div>
				<div class="form-row">
					<label for="login-password">Password</label>
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
		showMsg("Demo mode: any email and password combo signs you in, but no real account gets created.", 'success');
	}
}

function renderSignupForm() {
	root.innerHTML = `
		<div class="card-panel">
			<h1 style="margin-top:0;">Create your account</h1>
			<div id="form-msg"></div>
			<form id="signup-form">
				<div class="form-row">
					<label>Username</label>
					<input type="text" id="signup-username" required />
				</div>
				<div class="form-row">
					<label for="login-email">Email</label>
					<input type="email" id="signup-email" required />
				</div>
				<div class="form-row">
					<label for="login-password">Password</label>
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

	root.innerHTML = `
		<div class="card-panel" style="margin-bottom:24px;">
			<h1 style="margin-top:0;">Your profile</h1>
			<div id="form-msg"></div>
			<div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;">
				<div id="avatar-preview">${renderAvatar(profile, 64)}</div>
				<div>
					<button type="button" class="btn btn-outline btn-sm" id="avatar-pick-btn">Change photo</button>
					<input type="file" id="avatar-input" accept="image/*" style="display:none;" />
				</div>
			</div>
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
				<a href="my-listings.html" class="btn btn-outline">Manage your listings</a>
			</form>
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

	document.getElementById('avatar-pick-btn').addEventListener('click', () => {
		document.getElementById('avatar-input').click();
	});

	document.getElementById('avatar-input').addEventListener('change', async (e) => {
		const file = e.target.files[0];
		e.target.value = '';
		if (!file) return;
		const cropped = await openAvatarCropper(file);
		if (!cropped) return;
		const pickBtn = document.getElementById('avatar-pick-btn');
		pickBtn.disabled = true;
		pickBtn.textContent = 'Uploading…';
		try {
			const avatarFile = new File([cropped], 'avatar.jpg', { type: 'image/jpeg' });
			const url = await uploadAvatar(user.id, avatarFile);
			document.getElementById('avatar-preview').innerHTML = renderAvatar({ ...profile, avatar_url: url }, 64);
			document.dispatchEvent(new CustomEvent('fm:counts-changed'));
			showMsg('Profile photo updated.', 'success');
		} catch (err) {
			showMsg(err.message || 'Could not upload photo.', 'error');
		}
		pickBtn.disabled = false;
		pickBtn.textContent = 'Change photo';
	});
}

renderAccount();
