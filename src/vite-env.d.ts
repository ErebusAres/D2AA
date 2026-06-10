/// <reference types="vite/client" />

interface Window {
  D2AA_BUNGIE_REDIRECT_URI?: string;
}

interface ImportMetaEnv {
  readonly VITE_BUNGIE_API_KEY?: string;
  readonly VITE_BUNGIE_CLIENT_ID?: string;
  readonly VITE_BUNGIE_REDIRECT_URI?: string;
}
