import { useCallback, useEffect, useState } from 'react';
import { clearToken, getToken, handleOAuthRedirect, isSignedIn } from '../data/bungieAuth';
import { connectBungie } from '../data/bungieSync';
import type { AuthState } from '../types/auth';

export function useAuth(onStatus: (status: string) => void): AuthState & { login: () => void; logout: () => void } {
  const [auth, setAuth] = useState<AuthState>(() => ({ isSignedIn: isSignedIn(), token: getToken(), status: isSignedIn() ? 'Connected' : 'Signed out' }));

  useEffect(() => {
    handleOAuthRedirect()
      .then((handled) => {
        const next = { isSignedIn: isSignedIn(), token: getToken(), status: isSignedIn() ? 'Connected' : 'Signed out' };
        setAuth(next);
        if (handled) onStatus('Bungie sign-in complete.');
      })
      .catch((error: unknown) => onStatus(error instanceof Error ? error.message : String(error)));
  }, [onStatus]);

  const login = useCallback(() => connectBungie(), []);
  const logout = useCallback(() => {
    clearToken();
    setAuth({ isSignedIn: false, token: {}, status: 'Signed out' });
    onStatus('Signed out of Bungie.');
  }, [onStatus]);

  return { ...auth, login, logout };
}
