import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Handles the redirect from oauth.telegram.org after Telegram Login Widget auth.
// Backend sends the user here at /auth/telegram — the auth data arrives in the
// URL *hash fragment* (#tgAuthResult=BASE64URL_JSON) because browsers never
// include the fragment in server requests, so the backend cannot read it.
// This page decodes the hash and calls the existing /api/auth/telegram/widget
// POST endpoint, then handles the three possible outcomes:
//   1. Success  → set access token, navigate home
//   2. TOTP     → navigate to 2FA challenge page
//   3. Merge    → navigate to merge confirmation page
export function TelegramWidgetCallback() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      try {
        // 1. Read tgAuthResult from the hash fragment
        const hash = window.location.hash.slice(1);
        const params = new URLSearchParams(hash);
        const tgAuthResult = params.get('tgAuthResult');
        if (!tgAuthResult) {
          navigate('/auth/error?reason=telegram_no_data', { replace: true });
          return;
        }

        // 2. Decode base64url JSON → flat fields
        let fields: Record<string, string>;
        try {
          const decoded = JSON.parse(
            atob(tgAuthResult.replace(/-/g, '+').replace(/_/g, '/'))
          ) as Record<string, unknown>;
          fields = Object.fromEntries(
            Object.entries(decoded)
              .filter(([, v]) => v != null)
              .map(([k, v]) => [k, String(v)])
          );
        } catch {
          navigate('/auth/error?reason=telegram_decode_error', { replace: true });
          return;
        }

        // 3. Clear the hash so auth data doesn't sit in browser history
        window.history.replaceState(null, '', '/auth/telegram');

        // 4. POST to the widget endpoint (same endpoint used by the inline widget)
        const res = await fetch(`${API_BASE}/api/auth/telegram/widget`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-requested-with': 'webapp',
          },
          body: JSON.stringify(fields),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          const reason = body.message ?? `http_${res.status}`;
          navigate(`/auth/error?reason=${encodeURIComponent(reason)}`, { replace: true });
          return;
        }

        const data = await res.json() as {
          accessToken?: string;
          expiresIn?: number;
          totp?: boolean;
          challengeToken?: string;
          merge?: boolean;
          mergeToken?: string;
          summary?: Record<string, number>;
          otherDisplay?: string;
          provider?: string;
        };

        if (data.totp && data.challengeToken) {
          navigate(`/auth/2fa?token=${encodeURIComponent(data.challengeToken)}`, { replace: true });
          return;
        }

        if (data.merge && data.mergeToken) {
          const p = new URLSearchParams({
            token: data.mergeToken,
            summary: JSON.stringify(data.summary ?? {}),
            provider: data.provider ?? 'telegram',
            name: data.otherDisplay ?? '',
          });
          navigate(`/account/merge?${p.toString()}`, { replace: true });
          return;
        }

        if (data.accessToken) {
          const returnTo = sessionStorage.getItem('auth_return_to') ?? '/today';
          sessionStorage.removeItem('auth_return_to');
          flushSync(() => setAccessToken(data.accessToken!, data.expiresIn ?? 900));
          navigate(returnTo, { replace: true });
          return;
        }

        navigate('/auth/error?reason=telegram_unexpected_response', { replace: true });
      } catch {
        navigate('/auth/error?reason=telegram_failed', { replace: true });
      }
    })();
  }, [navigate, setAccessToken]);

  return (
    <div className="loader-center">
      <div className="spinner" />
    </div>
  );
}
