import { isSupabaseConfigured } from './supabase-client.js';
import {
	getCurrentUser,
	getProfile,
	updateProfile,
	uploadAvatar,
	signIn,
	signUp,
	signOut,
	getPayoutStatus,
	startPayoutOnboarding,
	getPayoutDashboardUrl,
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

		<div class="card-panel" id="payout-panel" style="margin-bottom:24px;">
			<h2 style="margin-top:0;">Getting paid</h2>
			<div id="payout-body"><p class="hint">Checking your payout account…</p></div>
		</div>

		<button class="btn btn-outline" id="signout-btn">Sign out</button>
	`;

	renderPayouts();

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

/* Payouts are the difference between a listing and a sale, so this states
   plainly where someone stands rather than hiding it behind a settings link.
   Stripe is asked for the live status on every render: the cached flags in the
   database exist so other pages can read them cheaply, not to be trusted here,
   where being wrong means telling someone they can be paid when they can't. */
async function renderPayouts() {
	const body = document.getElementById('payout-body');
	if (!body) return;

	let status;
	try {
		status = await getPayoutStatus();
	} catch (err) {
		body.innerHTML = `<p class="hint">Couldn't check your payout account: ${escapeHtml(err.message)}</p>
			<button class="btn btn-outline btn-sm" id="payout-retry">Try again</button>`;
		document.getElementById('payout-retry')?.addEventListener('click', renderPayouts);
		return;
	}

	if (status.demo) {
		body.innerHTML = `<p class="hint">Payouts run through Stripe, which needs the live project connected. In demo mode you can list and browse, but nothing can be bought or paid out.</p>`;
		return;
	}

	if (status.payoutsEnabled) {
		body.innerHTML = `
			<p class="payout-state is-ready"><span class="payout-dot" aria-hidden="true"></span>Your payout account is active.</p>
			<p class="hint">When a bottle sells, the price goes to your bank on Stripe's normal schedule and Vial keeps the 5% processing fee. You never handle the payment yourself.</p>
			<button class="btn btn-outline btn-sm" id="payout-dashboard">View payouts on Stripe</button>
		`;
		document.getElementById('payout-dashboard')?.addEventListener('click', async (e) => {
			const btn = e.currentTarget;
			btn.disabled = true;
			btn.textContent = 'Opening…';
			try {
				location.href = await getPayoutDashboardUrl();
			} catch (err) {
				btn.disabled = false;
				btn.textContent = 'View payouts on Stripe';
				showMsg(err.message, 'error');
			}
		});
		return;
	}

	// Submitted but not enabled means Stripe is either verifying or waiting on
	// a specific document. Saying "under review" to someone who actually needs
	// to upload an ID would leave them waiting on nothing.
	const waiting = status.detailsSubmitted && !(status.requirements || []).length;
	body.innerHTML = `
		<p class="payout-state ${waiting ? 'is-pending' : ''}"><span class="payout-dot" aria-hidden="true"></span>${
			waiting
				? 'Stripe is reviewing your details.'
				: status.connected
					? 'Your payout setup is unfinished.'
					: 'You have no payout account yet.'
		}</p>
		<p class="hint">${
			waiting
				? 'This usually takes a few minutes. Until it clears your listings stay visible, but nobody can buy them.'
				: 'Stripe collects your bank details, ID and tax information directly, so none of it passes through Vial. Until this is done your listings stay visible, but nobody can buy them.'
		}</p>
		<button class="btn btn-primary btn-sm" id="payout-start">${status.connected ? 'Finish payout setup' : 'Set up payouts'}</button>
	`;

	document.getElementById('payout-start')?.addEventListener('click', async (e) => {
		const btn = e.currentTarget;
		const label = btn.textContent;
		btn.disabled = true;
		btn.textContent = 'Opening Stripe…';
		try {
			location.href = await startPayoutOnboarding();
		} catch (err) {
			btn.disabled = false;
			btn.textContent = label;
			showMsg(err.message, 'error');
		}
	});
}

renderAccount();
