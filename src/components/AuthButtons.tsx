import type { AuthState } from '../types/auth';

interface AuthButtonsProps {
  auth: AuthState & { login: () => void; logout: () => void };
  onSync: () => void;
  isSyncing: boolean;
}

export default function AuthButtons({ auth, onSync, isSyncing }: AuthButtonsProps) {
  return (
    <>
      <button type="button" className="command-button command-button--gold" title="Sign in with Bungie" onClick={auth.isSignedIn ? auth.logout : auth.login}>
        <span className="bungie-mark" aria-hidden="true"><img src="https://www.bungie.net/favicon.ico" alt="" /></span>
        <b>{auth.isSignedIn ? 'Sign Out' : 'Sign In'}</b>
        <small>{auth.isSignedIn ? 'Connected' : 'Bungie'}</small>
      </button>
      <button type="button" className={`command-button ${isSyncing ? 'is-syncing' : ''}`} title="Manual Bungie armor sync" onClick={onSync} disabled={isSyncing}>
        <span>{isSyncing ? <i className="sync-spinner" aria-hidden="true" /> : '↻'}</span><b>{isSyncing ? 'Syncing' : 'Sync Armor'}</b><small>{auth.isSignedIn ? 'Full inventory' : 'Sign in first'}</small>
      </button>
    </>
  );
}
