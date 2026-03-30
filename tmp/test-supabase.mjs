import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env vars from .env
const envPath = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envContent = readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

// Merge with process.env
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('URL:', SUPABASE_URL ? 'SET' : 'MISSING');
console.log('Key:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. They must be set in Vercel only.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Test listBuckets
const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
if (bucketsError) {
  console.error('listBuckets error:', bucketsError);
  process.exit(1);
}
console.log('Buckets:', buckets.map(b => b.name));

// Test listing one bucket
for (const bucket of buckets) {
  const { data, error } = await supabase.storage.from(bucket.name).list('', { limit: 5 });
  if (error) {
    console.error(`list("${bucket.name}") error:`, error);
  } else {
    console.log(`Bucket "${bucket.name}" root items:`, data.map(f => ({ name: f.name, id: f.id, size: f.metadata?.size })));
  }
}
