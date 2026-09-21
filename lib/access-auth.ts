import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type AuthConfig = {
  AUTH_PROVIDER?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

export function authProvider(host: string, config: AuthConfig): 'sites' | 'cloudflare-access' | 'disabled' {
  if (config.AUTH_PROVIDER) {
    return config.AUTH_PROVIDER === 'sites' || config.AUTH_PROVIDER === 'cloudflare-access'
      ? config.AUTH_PROVIDER : 'disabled';
  }
  if (config.CF_ACCESS_TEAM_DOMAIN || config.CF_ACCESS_AUD) return 'cloudflare-access';
  // Only Sites dispatch and the loopback development middleware supply trusted OAI headers.
  const hostname = host.toLowerCase().replace(/:\d+$/, '');
  return hostname.endsWith('.chatgpt.site') || ['localhost', '127.0.0.1', '[::1]', 'terminal.local'].includes(hostname)
    ? 'sites' : 'cloudflare-access';
}

export function accessIssuer(config: AuthConfig): string | null {
  const value = config.CF_ACCESS_TEAM_DOMAIN?.replace(/\/$/, '');
  return value && /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(value) ? value : null;
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyAccessUser(token: string | null, config: AuthConfig, testKey?: JWTVerifyGetKey) {
  const issuer = accessIssuer(config);
  if (!token || !issuer || !config.CF_ACCESS_AUD) return null;
  try {
    let key = testKey ?? keySets.get(issuer);
    if (!key) {
      key = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
      keySets.set(issuer, key as ReturnType<typeof createRemoteJWKSet>);
    }
    const { payload } = await jwtVerify(token, key, {
      issuer, audience: config.CF_ACCESS_AUD, algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || !payload.email) return null;
    return { userId: payload.sub, email: payload.email, displayName: payload.email, fullName: null };
  } catch {
    // Never fall back to unverified email or Sites headers on an Access deployment.
    return null;
  }
}

export function safeReturnTo(value: string | null): string {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local' || /^\/(auth(?:\/|$)|signin-with-chatgpt|signout-with-chatgpt|callback|cdn-cgi)/.test(url.pathname)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/'; }
}
