// Data access layer. Every page talks to the app through these functions so
// that swapping demo mode for a live Supabase project later doesn't require
// touching page code — only this file.
import { getSupabase, isSupabaseConfigured } from './supabase-client.js';
import { MOCK_LISTINGS, MOCK_PROFILES } from './mock-data.js';

const LOCAL_LISTINGS_KEY = 'fm_demo_listings';
const LOCAL_SESSION_KEY = 'fm_demo_session';
const LOCAL_PROFILES_KEY = 'fm_demo_profiles';

const uid = () => 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function readLocal(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch {
		return fallback;
	}
}
function writeLocal(key, value) {
	localStorage.setItem(key, JSON.stringify(value));
}

function localListings() {
	return readLocal(LOCAL_LISTINGS_KEY, []);
}
function localProfiles() {
	return readLocal(LOCAL_PROFILES_KEY, {});
}

export function getDemoSession() {
	return readLocal(LOCAL_SESSION_KEY, null);
}

// ---------- Auth ----------

export async function getCurrentUser() {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data } = await supabase.auth.getUser();
		return data?.user || null;
	}
	return getDemoSession();
}

export async function signUp({ email, password, username }) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase.auth.signUp({ email, password });
		if (error) throw error;
		if (data.user) {
			await supabase.from('profiles').update({ username }).eq('id', data.user.id);
		}
		return data.user;
	}
	const id = 'demo-' + uid();
	const user = { id, email, username: username || email.split('@')[0] };
	writeLocal(LOCAL_SESSION_KEY, user);
	const profiles = localProfiles();
	profiles[id] = {
		id,
		username: user.username,
		display_name: user.username,
		location: '',
		bio: '',
	};
	writeLocal(LOCAL_PROFILES_KEY, profiles);
	return user;
}

export async function signIn({ email, password }) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) throw error;
		return data.user;
	}
	// Demo mode has no real password check — it's just a local session stub.
	const id = 'demo-' + btoa(email).replace(/[^a-zA-Z0-9]/g, '');
	const username = email.split('@')[0];
	const user = { id, email, username };
	writeLocal(LOCAL_SESSION_KEY, user);
	const profiles = localProfiles();
	if (!profiles[id]) {
		profiles[id] = { id, username, display_name: username, location: '', bio: '' };
		writeLocal(LOCAL_PROFILES_KEY, profiles);
	}
	return user;
}

export async function signOut() {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		await supabase.auth.signOut();
		return;
	}
	localStorage.removeItem(LOCAL_SESSION_KEY);
}

// ---------- Profiles ----------

export async function getProfile(id) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
		if (error) return null;
		return data;
	}
	return MOCK_PROFILES[id] || localProfiles()[id] || null;
}

export async function updateProfile(id, updates) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { error } = await supabase.from('profiles').update(updates).eq('id', id);
		if (error) throw error;
		return;
	}
	const profiles = localProfiles();
	profiles[id] = { ...(profiles[id] || {}), ...updates, id };
	writeLocal(LOCAL_PROFILES_KEY, profiles);
}

// ---------- Listings ----------

function attachProfile(listing) {
	if (listing.profiles) return listing;
	const profile = MOCK_PROFILES[listing.seller_id] || localProfiles()[listing.seller_id] || null;
	return { ...listing, profiles: profile };
}

function matchesFilters(listing, filters) {
	const { search, brand, scentFamily, gender, condition, minPrice, maxPrice } = filters;
	if (search) {
		const q = search.toLowerCase();
		const haystack = `${listing.brand} ${listing.name} ${(listing.scent_family || []).join(' ')}`.toLowerCase();
		if (!haystack.includes(q)) return false;
	}
	if (brand && listing.brand !== brand) return false;
	if (gender && listing.gender !== gender) return false;
	if (condition && listing.condition !== condition) return false;
	if (scentFamily && scentFamily.length) {
		const families = listing.scent_family || [];
		if (!scentFamily.some((f) => families.includes(f))) return false;
	}
	if (minPrice != null && listing.price < minPrice) return false;
	if (maxPrice != null && listing.price > maxPrice) return false;
	return true;
}

export async function getListings(filters = {}) {
	let listings;
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('listings')
			.select('*, profiles(id, username, display_name, location)')
			.order('created_at', { ascending: false });
		if (error) throw error;
		listings = data || [];
	} else {
		listings = [...MOCK_LISTINGS, ...localListings()].map(attachProfile);
	}
	if (!filters.includeSold) {
		listings = listings.filter((l) => l.status === 'available');
	}
	listings = listings.filter((l) => matchesFilters(l, filters));

	if (filters.sort === 'price_asc') listings.sort((a, b) => a.price - b.price);
	else if (filters.sort === 'price_desc') listings.sort((a, b) => b.price - a.price);
	else listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

	return listings;
}

export async function getListingById(id) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('listings')
			.select('*, profiles(id, username, display_name, location, bio)')
			.eq('id', id)
			.single();
		if (error) return null;
		return data;
	}
	const all = [...MOCK_LISTINGS, ...localListings()];
	const listing = all.find((l) => l.id === id);
	return listing ? attachProfile(listing) : null;
}

export async function getListingsBySeller(sellerId) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('listings')
			.select('*')
			.eq('seller_id', sellerId)
			.order('created_at', { ascending: false });
		if (error) return [];
		return data;
	}
	return [...MOCK_LISTINGS, ...localListings()].filter((l) => l.seller_id === sellerId);
}

export async function createListing(listing, imageFiles = []) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const images = [];
		for (const file of imageFiles) {
			const path = `${listing.seller_id}/${Date.now()}-${file.name}`;
			const { error: uploadError } = await supabase.storage.from('listing-images').upload(path, file);
			if (uploadError) throw uploadError;
			const { data } = supabase.storage.from('listing-images').getPublicUrl(path);
			images.push(data.publicUrl);
		}
		const { data, error } = await supabase
			.from('listings')
			.insert({ ...listing, images })
			.select()
			.single();
		if (error) throw error;
		return data;
	}
	const images = await Promise.all(imageFiles.slice(0, 4).map(fileToDataUrl));
	const newListing = {
		...listing,
		id: uid(),
		images: images.length ? images : ['🧴'],
		status: 'available',
		created_at: new Date().toISOString(),
	};
	const listings = localListings();
	listings.unshift(newListing);
	writeLocal(LOCAL_LISTINGS_KEY, listings);
	return newListing;
}

export async function updateListingStatus(id, status) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { error } = await supabase.from('listings').update({ status }).eq('id', id);
		if (error) throw error;
		return;
	}
	const listings = localListings();
	const idx = listings.findIndex((l) => l.id === id);
	if (idx !== -1) {
		listings[idx].status = status;
		writeLocal(LOCAL_LISTINGS_KEY, listings);
	}
}

function fileToDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export const SCENT_FAMILIES = [
	'citrus', 'floral', 'woody', 'spicy', 'vanilla', 'aromatic',
	'oud', 'musky', 'fruity', 'gourmand', 'aquatic', 'smoky',
];

export const CONDITIONS = [
	{ value: 'new', label: 'New / Unused' },
	{ value: 'like_new', label: 'Like New' },
	{ value: 'gently_used', label: 'Gently Used' },
	{ value: 'well_used', label: 'Well Used' },
];
