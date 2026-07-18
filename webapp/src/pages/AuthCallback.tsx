import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

// Handles redirect from backend after OAuth (Google, VK, Telegram widget).
// Backend redirects to /auth/callback#access_token=...&expires_in=...
//
// Telegram Login Widget with data-auth-url opens a popup for auth.
// After auth the popup lands here. We detect the popup context and
// redirect the main page (window.opener) here with the token, then
// close the popup — so the main page handles auth normally.
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
      // If we're inside a popup (Telegram widget data-auth-url flow),
      // hand the token to the main window and close the popup.
      if (window.opener && window.opener !== window) {
        try {
          window.opener.location.href =
            `/auth/callback#access_token=${encodeURIComponent(token)}&expires_in=${expiresIn}`;
        } catch { /* opener is cross-origin — ignore */ }
        window.close();
        return;
      }

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
