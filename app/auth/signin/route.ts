import { env } from 'cloudflare:workers';
import { authProvider, safeReturnTo, verifyAccessUser } from '../../../lib/access-auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get('return_to'));
  const provider = authProvider(url.host, env);
  if (provider === 'sites') {
    return new Response(null, { status: 302, headers: {
      Location: `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`, 'Cache-Control': 'no-store',
    } });
  }
  if (provider === 'cloudflare-access' && await verifyAccessUser(request.headers.get('cf-access-jwt-assertion'), env)) {
    return new Response(null, { status: 302, headers: { Location: returnTo, 'Cache-Control': 'no-store' } });
  }
  // Access protects the whole hostname and performs login before this route runs.
  // A request reaching here without a valid identity indicates missing setup.
  return new Response('El acceso de Cloudflare todavía no está configurado o la sesión no es válida. Activa Cloudflare Access para este dominio y configura CF_ACCESS_TEAM_DOMAIN y CF_ACCESS_AUD en el Worker. Después vuelve a abrir la página principal.', {
    status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
