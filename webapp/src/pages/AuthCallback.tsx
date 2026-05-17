import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Handles redirect from backend after Google OAuth.
// Backend redirects to /auth/callback#access_token=...&expires_in=...
export function AuthCallback() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') ?? '900', 10);

    // Clear token from URL immediately
    window.history.replaceState(null, '', '/auth/callback');

    if (token) {
      setAccessToken(token, expiresIn);
      navigate('/', { replace: true });
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
