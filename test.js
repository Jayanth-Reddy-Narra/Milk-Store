const { createClient } = require('https://cdn.skypack.dev/@supabase/supabase-js');
const SUPABASE_URL = "https://jrvyzzikpfaohjkypvmz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_I9NalIe1-cp_-G_ZszMhLg_AO66KUwI";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
supabase.auth.getSession().then(res => console.log('OK')).catch(err => console.error('Error:', err));
