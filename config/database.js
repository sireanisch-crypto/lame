// database.js - Supabase Configuration
const { createClient } = require('@supabase/supabase-js');

// Create a single Supabase client for the app to use
const supabase = createClient(
  process.env.SUPABASE_URL, // Your new Supabase Project URL
  process.env.SUPABASE_ANON_KEY // Your new Supabase Anon Key
);

module.exports = { supabase };