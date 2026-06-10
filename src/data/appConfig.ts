import type { BungiePublicConfig } from '../types/auth';

const FALLBACK_DEPLOY_PATH = '/D2AA/';
const LEGACY_STATIC_PAGE_RE = /\/(?:D2AA|d2aa-clean|beta2)\.html$/i;

export const PUBLIC_BUNGIE_CONFIG: Omit<BungiePublicConfig, 'redirectUri'> = {
  apiKey: import.meta.env.VITE_BUNGIE_API_KEY || '96e154014bdd44c0a537e482709b7473',
  clientId: import.meta.env.VITE_BUNGIE_CLIENT_ID || '50794'
};

export function defaultBungieRedirectUri(): string {
  const explicit = import.meta.env.VITE_BUNGIE_REDIRECT_URI || window.D2AA_BUNGIE_REDIRECT_URI;
  if (explicit) return normalizeBungieRedirectUri(explicit);
  return `${location.origin}${FALLBACK_DEPLOY_PATH}`;
}

export function normalizeBungieRedirectUri(value: string | undefined): string {
  if (!value) return defaultBungieRedirectUri();
  const url = new URL(value, location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  if (LEGACY_STATIC_PAGE_RE.test(url.pathname)) {
    url.pathname = `${url.pathname.replace(LEGACY_STATIC_PAGE_RE, '').replace(/\/?$/, '/')}`;
  }
  if (url.pathname === '/') url.pathname = FALLBACK_DEPLOY_PATH;
  return url.toString();
}
