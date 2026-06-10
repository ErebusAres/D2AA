import type { AuthState } from '../types/auth';

interface AuthButtonsProps {
  auth: AuthState & { login: () => void; logout: () => void };
  onSync: () => void;
}

export default function AuthButtons({ auth, onSync }: AuthButtonsProps) {
  return (
    <>
      <button type="button" className="command-button command-button--gold" title="Sign in with Bungie" onClick={auth.isSignedIn ? auth.logout : auth.login}>
        <span className="bungie-mark" aria-hidden="true"><img src="https://www.bungie.net/favicon.ico" alt="" /></span>
        <b>{auth.isSignedIn ? 'Sign Out' : 'Sign In'}</b>
        <small>Bungie</small>
      </button>
      <button type="button" className="command-button" title="Manual Bungie armor sync" onClick={onSync}>
        <span>↓</span><b>Sync Armor</b><small>Full inventory</small>
      </button>
    </>
  );
}
