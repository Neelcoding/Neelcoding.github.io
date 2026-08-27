// Fill these in once you've created a Supabase project (https://supabase.com/dashboard).
// Project Settings -> API -> Project URL / anon public key.
// Until real values are set, the site runs in demo mode using mock data + localStorage.
export const SUPABASE_URL = 'https://jtepvfnipteigidxtsfr.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_TFPwJYL_rDIKRIt1kA3lIQ_PCP910LY';

export const isSupabaseConfigured =
	!SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_');

let client = null;

export async function getSupabase() {
	if (!isSupabaseConfigured) return null;
	if (client) return client;
	const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
	client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
	return client;
}
