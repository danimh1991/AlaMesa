import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
const destination = new URL('../.sites-runtime/auth-test.mjs', import.meta.url);
mkdirSync(new URL('./', destination), { recursive: true });
writeFileSync(destination, ts.transpileModule(readFileSync(new URL('../lib/access-auth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText);
const { authProvider, verifyAccessUser, safeReturnTo } = await import(destination.href);
const config = { CF_ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com', CF_ACCESS_AUD: 'alamesa' };
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
const key = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test', alg: 'RS256' }] });
async function token(overrides = {}, signingKey = privateKey) {
  return new SignJWT({ email: 'test@example.com', sub: 'user-1', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+300, iss: config.CF_ACCESS_TEAM_DOMAIN, aud: config.CF_ACCESS_AUD, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(signingKey);
}
assert.equal((await verifyAccessUser(await token(), config, key)).email, 'test@example.com');
for (const overrides of [{ exp: 1 }, { aud: 'another-app' }, { iss: 'https://other.cloudflareaccess.com' }, { email: undefined }, { sub: '' }, { exp: undefined }]) {
  assert.equal(await verifyAccessUser(await token(overrides), config, key), null);
}
const foreign = await generateKeyPair('RS256');
assert.equal(await verifyAccessUser(await token({}, foreign.privateKey), config, key), null);
assert.equal(await verifyAccessUser('invalid', config, key), null);
assert.equal(await verifyAccessUser(null, config, key), null);
assert.equal(await verifyAccessUser(await token(), {}, key), null);
assert.equal(await verifyAccessUser(await token(), { ...config, CF_ACCESS_TEAM_DOMAIN: 'https://attacker.example' }, key), null);
assert.equal(authProvider('alamesa.dani-mh1991.workers.dev', {}), 'cloudflare-access');
assert.equal(authProvider('custom.example', {}), 'cloudflare-access');
assert.equal(authProvider('mesa-de-dani-y-marta.dani-mh1991.chatgpt.site', {}), 'sites');
assert.equal(authProvider('127.0.0.1:5173', {}), 'sites');
assert.equal(authProvider('127.0.0.1:5173', { AUTH_PROVIDER: 'cloudflare-access' }), 'cloudflare-access');
assert.equal(authProvider('x.chatgpt.site', { AUTH_PROVIDER: 'typo' }), 'disabled');
assert.equal(authProvider('x.chatgpt.site.attacker.example', {}), 'cloudflare-access');
for (const value of ['//evil.example', '/\\evil.example', '/auth/signin', '/signin-with-chatgpt', '/cdn-cgi/access/logout', 'https://evil.example']) assert.equal(safeReturnTo(value), '/');
assert.equal(safeReturnTo('/?month=2026-10'), '/?month=2026-10');
console.log('PASS: Access signatures, expiry, issuer, audience, required claims, missing setup, provider selection and safe redirects.');
