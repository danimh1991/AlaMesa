import { env } from 'cloudflare:workers';
import { authProvider, safeReturnTo } from '../../../lib/access-auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const location = authProvider(url.host, env) === 'sites'
    ? `/signout-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo(url.searchParams.get('return_to')))}`
    : '/cdn-cgi/access/logout';
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}
