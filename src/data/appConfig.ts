import type { BungiePublicConfig } from '../types/auth';

const FALLBACK_DEPLOY_PATH = '/D2AA/';

export const PUBLIC_BUNGIE_CONFIG: Omit<BungiePublicConfig, 'redirectUri'> = {
  apiKey: import.meta.env.VITE_BUNGIE_API_KEY || '96e154014bdd44c0a537e482709b7473',
  clientId: import.meta.env.VITE_BUNGIE_CLIENT_ID || '50794'
};

export function defaultBungieRedirectUri(): string {
  const explicit = import.meta.env.VITE_BUNGIE_REDIRECT_URI || window.D2AA_BUNGIE_REDIRECT_URI;
  if (explicit) return cleanUrl(explicit);
  const segment = location.pathname.split('/').filter(Boolean)[0];
  if (segment) return `${location.origin}/${segment}/`;
  return `${location.origin}${FALLBACK_DEPLOY_PATH}`;
}

function cleanUrl(value: string): string {
  const url = new URL(value, location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  return url.toString();
}
