import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Handles redirect from backend after OAuth (Google, VK, Telegram OIDC).
// Backend redirects to /auth/callback#access_token=...&expires_in=...
export function AuthCallback() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') ?? '900', 10);

    window.history.replaceState(null, '', '/auth/callback');

    if (token) {
      const returnTo = sessionStorage.getItem('auth_return_to') ?? '/today';
      sessionStorage.removeItem('auth_return_to');
      // flushSync forces the state update to complete synchronously before
      // navigate() — otherwise RequireAuth renders with isAuthenticated=false
      // and immediately redirects to /login.
      flushSync(() => setAccessToken(token, expiresIn));
      navigate(returnTo, { replace: true });
    } else {
      navigate('/login?error=no_token', { replace: true });
    }
  }, [navigate, setAccessToken]);

  return (
    <div className="loader-center">
      <div className="spinner" />
    </div>
  );
}
