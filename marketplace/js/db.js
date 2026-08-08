// Data access layer. Every page talks to the app through these functions so
// that swapping demo mode for a live Supabase project later doesn't require
// touching page code, only this file.
import { getSupabase, isSupabaseConfigured } from './supabase-client.js';
import { MOCK_LISTINGS, MOCK_PROFILES } from './mock-data.js';

const LOCAL_LISTINGS_KEY = 'fm_demo_listings';
const LOCAL_SESSION_KEY = 'fm_demo_session';
const LOCAL_PROFILES_KEY = 'fm_demo_profiles';
const LOCAL_CONVERSATIONS_KEY = 'fm_demo_conversations';
const LOCAL_MESSAGES_KEY = 'fm_demo_messages';
const LOCAL_OFFERS_KEY = 'fm_demo_offers';
const LOCAL_BIDS_KEY = 'fm_demo_bids';

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
function localConversations() {
	return readLocal(LOCAL_CONVERSATIONS_KEY, []);
}
function localMessages() {
	return readLocal(LOCAL_MESSAGES_KEY, []);
}
function localOffers() {
	return readLocal(LOCAL_OFFERS_KEY, []);
}
function localBids() {
	return readLocal(LOCAL_BIDS_KEY, []);
}
function profileById(id) {
	return MOCK_PROFILES[id] || localProfiles()[id] || null;
}
function listingById(id) {
	return [...MOCK_LISTINGS, ...localListings()].find((l) => l.id === id) || null;
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
	// Demo mode has no real password check, it's just a local session stub.
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

export async function uploadAvatar(userId, file) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const path = `${userId}/${Date.now()}-${file.name}`;
		const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
		if (uploadError) throw uploadError;
		const { data } = supabase.storage.from('avatars').getPublicUrl(path);
		await updateProfile(userId, { avatar_url: data.publicUrl });
		return data.publicUrl;
	}
	const dataUrl = await fileToDataUrl(file);
	await updateProfile(userId, { avatar_url: dataUrl });
	return dataUrl;
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
			.select('*, profiles(id, username, display_name, location, avatar_url)')
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
			.select('*, profiles(id, username, display_name, location, bio, avatar_url)')
			.eq('id', id)
			.single();
		if (error) return null;
		return data;
	}
	const all = [...MOCK_LISTINGS, ...localListings()];
	const listing = all.find((l) => l.id === id);
	return listing ? attachProfile(listing) : null;
}

export async function getListingsByIds(ids) {
	if (!ids?.length) return [];
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('listings')
			.select('*, profiles(id, username, display_name, location, avatar_url)')
			.in('id', ids);
		if (error) throw error;
		return data || [];
	}
	return [...MOCK_LISTINGS, ...localListings()]
		.filter((l) => ids.includes(l.id))
		.map(attachProfile);
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
		images,
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

// ---------- Messaging ----------

export async function getOrCreateConversation({ listingId, sellerId, buyerId }) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data: existing } = await supabase
			.from('conversations')
			.select('*')
			.eq('listing_id', listingId)
			.eq('buyer_id', buyerId)
			.eq('seller_id', sellerId)
			.maybeSingle();
		if (existing) return existing;
		const { data, error } = await supabase
			.from('conversations')
			.insert({ listing_id: listingId, buyer_id: buyerId, seller_id: sellerId })
			.select()
			.single();
		if (error) throw error;
		return data;
	}
	const list = localConversations();
	let convo = list.find((c) => c.listing_id === listingId && c.buyer_id === buyerId && c.seller_id === sellerId);
	if (!convo) {
		convo = { id: uid(), listing_id: listingId, buyer_id: buyerId, seller_id: sellerId, created_at: new Date().toISOString() };
		list.push(convo);
		writeLocal(LOCAL_CONVERSATIONS_KEY, list);
	}
	return convo;
}

export async function getConversations(userId) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('conversations')
			.select('*, listings(id, brand, name), buyer:buyer_id(id, username, display_name, avatar_url), seller:seller_id(id, username, display_name, avatar_url)')
			.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
			.order('created_at', { ascending: false });
		if (error) throw error;
		return data || [];
	}
	return localConversations()
		.filter((c) => c.buyer_id === userId || c.seller_id === userId)
		.map((c) => ({
			...c,
			listings: listingById(c.listing_id),
			buyer: profileById(c.buyer_id),
			seller: profileById(c.seller_id),
		}))
		.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getMessages(conversationId) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('messages')
			.select('*')
			.eq('conversation_id', conversationId)
			.order('created_at', { ascending: true });
		if (error) throw error;
		return data || [];
	}
	return localMessages()
		.filter((m) => m.conversation_id === conversationId)
		.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function sendMessage({ conversationId, senderId, body }) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('messages')
			.insert({ conversation_id: conversationId, sender_id: senderId, body })
			.select()
			.single();
		if (error) throw error;
		return data;
	}
	const list = localMessages();
	const msg = { id: uid(), conversation_id: conversationId, sender_id: senderId, body, created_at: new Date().toISOString() };
	list.push(msg);
	writeLocal(LOCAL_MESSAGES_KEY, list);
	return msg;
}

export async function markConversationRead({ conversationId, isBuyer }) {
	const field = isBuyer ? 'buyer_last_read_at' : 'seller_last_read_at';
	const now = new Date().toISOString();
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		await supabase.from('conversations').update({ [field]: now }).eq('id', conversationId);
		return;
	}
	const list = localConversations();
	const idx = list.findIndex((c) => c.id === conversationId);
	if (idx !== -1) {
		list[idx][field] = now;
		writeLocal(LOCAL_CONVERSATIONS_KEY, list);
	}
}

export async function getUnreadConversationCount(userId) {
	const conversations = await getConversations(userId);
	if (!conversations.length) return 0;
	const ids = conversations.map((c) => c.id);
	let allMessages;
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data } = await supabase
			.from('messages')
			.select('conversation_id, sender_id, created_at')
			.in('conversation_id', ids)
			.order('created_at', { ascending: false });
		allMessages = data || [];
	} else {
		allMessages = localMessages().filter((m) => ids.includes(m.conversation_id));
	}
	const latestByConvo = {};
	allMessages
		.slice()
		.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
		.forEach((m) => {
			if (!latestByConvo[m.conversation_id]) latestByConvo[m.conversation_id] = m;
		});
	return conversations.filter((c) => {
		const latest = latestByConvo[c.id];
		if (!latest || latest.sender_id === userId) return false;
		const lastRead = c.buyer_id === userId ? c.buyer_last_read_at : c.seller_last_read_at;
		return new Date(latest.created_at) > new Date(lastRead || 0);
	}).length;
}

// ---------- Offers ----------

export async function createOffer({ listingId, sellerId, buyerId, amount, message }) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('offers')
			.insert({ listing_id: listingId, seller_id: sellerId, buyer_id: buyerId, amount, message })
			.select()
			.single();
		if (error) throw new Error(error.message);
		return data;
	}
	const listing = listingById(listingId);
	if (listing && Number(amount) >= Number(listing.price)) {
		throw new Error('Offer must be lower than the asking price');
	}
	const list = localOffers();
	const offer = {
		id: uid(),
		listing_id: listingId,
		seller_id: sellerId,
		buyer_id: buyerId,
		amount: Number(amount),
		message: message || '',
		status: 'pending',
		created_at: new Date().toISOString(),
	};
	list.push(offer);
	writeLocal(LOCAL_OFFERS_KEY, list);
	return offer;
}

export async function getOffersForSeller(sellerId) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('offers')
			.select('*, listings(id, brand, name, price, status), buyer:buyer_id(id, username, display_name, avatar_url)')
			.eq('seller_id', sellerId)
			.order('amount', { ascending: false });
		if (error) throw error;
		return data || [];
	}
	return localOffers()
		.filter((o) => o.seller_id === sellerId)
		.map((o) => ({ ...o, listings: listingById(o.listing_id), buyer: profileById(o.buyer_id) }))
		.sort((a, b) => b.amount - a.amount);
}

export async function getOffersForBuyer(buyerId) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('offers')
			.select('*, listings(id, brand, name, price, status)')
			.eq('buyer_id', buyerId)
			.order('created_at', { ascending: false });
		if (error) throw error;
		return data || [];
	}
	return localOffers()
		.filter((o) => o.buyer_id === buyerId)
		.map((o) => ({ ...o, listings: listingById(o.listing_id) }))
		.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function respondToOffer(offerId, status) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { error } = await supabase.from('offers').update({ status }).eq('id', offerId);
		if (error) throw error;
		return;
	}
	const list = localOffers();
	const idx = list.findIndex((o) => o.id === offerId);
	if (idx !== -1) {
		list[idx].status = status;
		writeLocal(LOCAL_OFFERS_KEY, list);
	}
}

// ---------- Auctions / bids ----------

export async function getBids(listingId) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('bids')
			.select('*, bidder:bidder_id(id, username, display_name)')
			.eq('listing_id', listingId)
			.order('amount', { ascending: false });
		if (error) throw error;
		return data || [];
	}
	return localBids()
		.filter((b) => b.listing_id === listingId)
		.map((b) => ({ ...b, bidder: profileById(b.bidder_id) }))
		.sort((a, b) => b.amount - a.amount);
}

export async function placeBid({ listingId, bidderId, amount }) {
	if (isSupabaseConfigured) {
		const supabase = await getSupabase();
		const { data, error } = await supabase
			.from('bids')
			.insert({ listing_id: listingId, bidder_id: bidderId, amount })
			.select()
			.single();
		if (error) throw new Error(error.message);
		return data;
	}
	const listing = listingById(listingId);
	if (!listing || !listing.is_auction) throw new Error('This listing is not an auction');
	if (listing.auction_ends_at && new Date() > new Date(listing.auction_ends_at)) throw new Error('This auction has ended');
	const existingBids = localBids().filter((b) => b.listing_id === listingId);
	const currentHigh = existingBids.length ? Math.max(...existingBids.map((b) => b.amount)) : Number(listing.price);
	if (Number(amount) <= currentHigh) throw new Error(`Your bid must be higher than $${currentHigh}`);
	const list = localBids();
	const bid = { id: uid(), listing_id: listingId, bidder_id: bidderId, amount: Number(amount), created_at: new Date().toISOString() };
	list.push(bid);
	writeLocal(LOCAL_BIDS_KEY, list);
	return bid;
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
