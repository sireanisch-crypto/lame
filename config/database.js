// config/database.js - Supabase Configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Use the service role key

export const supabase = createClient(supabaseUrl, supabaseServiceKey);