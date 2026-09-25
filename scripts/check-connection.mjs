// Read-only connectivity check. Never logs keys, tokens, or row contents.
import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');
const base = process.env.VITE_SUPABASE_URL;
const headers = { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY };
for (const path of ['/auth/v1/settings', '/rest/v1/qm_cards?select=id&limit=1']) {
  const response = await fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (path.includes('/settings')) {
    console.log(JSON.stringify({ endpoint: 'auth settings', status: response.status, emailEnabled: data.external?.email, signupDisabled: data.disable_signup, emailAutoconfirm: data.mailer_autoconfirm }));
  } else {
    console.log(JSON.stringify({ endpoint: 'anonymous cards read', status: response.status, code: data.code, returnedRows: Array.isArray(data) ? data.length : undefined }));
  }
}
