// Nonce для Google One Tap (сервер: src/auth/google-one-tap-nonce.ts).
// GET ставит httpOnly-куку gsi_nonce и отдаёт SHA-256 её секрета; страница
// передаёт его в GIS, и Google вписывает его в id_token. Любой сбой → null:
// One Tap необязателен, остаются обычные кнопки входа.
export async function fetchOneTapNonce(apiBase: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase}/api/auth/google/one-tap/nonce`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { nonce?: unknown };
    return typeof body.nonce === 'string' && body.nonce ? body.nonce : null;
  } catch {
    return null;
  }
}
