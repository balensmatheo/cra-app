import { NextRequest } from 'next/server';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB default cap
const ALLOWED_MIME_PREFIX = 'image/';
const DISALLOWED_MIME = new Set(['image/svg+xml', 'text/html', 'application/xhtml+xml']);

function sanitize(urlStr: string) {
  try {
    const u = new URL(urlStr);
    u.hash = '';
    // Security: only allow http/https
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('Unsupported protocol');
    }
    return u.toString();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || '';
  const cleaned = sanitize(url);
  if (!cleaned) {
    return new Response(
      JSON.stringify({ ok: false, error: 'URL invalide' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
  if (cleaned.length > 2048) {
    return new Response(
      JSON.stringify({ ok: false, error: 'URL trop longue' }),
      { status: 414, headers: { 'content-type': 'application/json' } }
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(cleaned, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Ressource injoignable' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
    const ct = res.headers.get('content-type') || '';
    const lenStr = res.headers.get('content-length') || '';
    const len = parseInt(lenStr, 10);
    if (!ct || !ct.toLowerCase().startsWith(ALLOWED_MIME_PREFIX) || DISALLOWED_MIME.has(ct.toLowerCase())) {
      return new Response(
        JSON.stringify({ ok: false, error: "Le lien collé n’est pas une image valide" }),
        { status: 415, headers: { 'content-type': 'application/json' } }
      );
    }
    if (!isNaN(len) && len > MAX_IMAGE_BYTES) {
      return new Response(
        JSON.stringify({ ok: false, error: `Image trop volumineuse (max : ${Math.round(MAX_IMAGE_BYTES/1024/1024)} Mo)` }),
        { status: 413, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ ok: true, url: cleaned, contentType: ct, contentLength: isNaN(len) ? null : len }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    clearTimeout(timer);
    return new Response(
      JSON.stringify({ ok: false, error: 'Impossible de charger cette image (accès ou format).' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
}
