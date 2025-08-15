import outputs from '../amplify_outputs.json';
import { fetchAuthSession } from 'aws-amplify/auth';

function getBaseUrl(): string | null {
  const anyOut = outputs as any;
  const url = anyOut?.adminApi?.url || anyOut?.api?.adminApi?.url;
  return typeof url === 'string' ? url : null;
}

async function authHeader() {
  try {
    const sess = await fetchAuthSession();
    const token = sess.tokens?.idToken?.toString();
    return token ? { Authorization: token } : {};
  } catch {
    return {};
  }
}

export async function listUsersApi(search?: string) {
  const base = getBaseUrl();
  if (!base) throw new Error('Admin API URL not configured');
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) } as any;
  const url = new URL(`${base}/admin/list-users`);
  if (search) url.searchParams.set('search', search);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createUserApi(payload: { email: string; groups?: string[] }) {
  const base = getBaseUrl();
  if (!base) throw new Error('Admin API URL not configured');
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) } as any;
  const res = await fetch(`${base}/admin/create-user`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
