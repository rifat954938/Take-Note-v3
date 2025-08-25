/**
 * config.js
 * Supabase configuration and initialization
 */

// Supabase configuration
const SUPABASE_URL = 'https://yeljcxmwebhlogzaqdlc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGpjeG13ZWJobG9nemFxZGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwOTkzNTcsImV4cCI6MjA3MTY3NTM1N30.LKfPZdDKE51s5UVscZ0y1Ipjz-xzfF8BBAAfXtQN4Cw';

// Initialize Supabase client
const { createClient } = supabase;
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other modules
window.SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
};