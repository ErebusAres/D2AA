export interface BungiePublicConfig {
  apiKey: string;
  clientId: string;
  redirectUri: string;
}

export interface BungieToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  expires_at?: number;
  refresh_expires_at?: number;
  saved_at?: number;
  membership_id?: string;
  token_type?: string;
}

export interface AuthState {
  isSignedIn: boolean;
  token: BungieToken;
  status: string;
}
