// Общий предохранитель от НЕИЗВЕСТНЫХ петель редиректа (2026-09-16, см.
// oauth-host.ts): даже если пара редиректоров, зациклившая запрос, — не та,
// что уже отловлена явной проверкой (isRedirectedHost), второй проход через
// этот редиректор обрывается по маркеру, а не крутится до
// ERR_TOO_MANY_REDIRECTS.
//
// Маркер живёт ровно на одном хопе: redirectToCallbackHost редиректит на наш
// СОБСТВЕННЫЙ /api/auth/<provider> (тот же путь+query, другой хост), а не на
// URL провайдера — тот строится отдельно, из конфига, в buildAuthUrl(). В
// redirect_uri, который видит Google/VK, маркер никогда не попадает.
const LOOP_GUARD_PARAM = '_oh';
const MARKER_RE = new RegExp(`[?&]${LOOP_GUARD_PARAM}=1(?:&|$)`);

export function hasLoopGuardMarker(originalUrl: string): boolean {
  return MARKER_RE.test(originalUrl);
}

export function withLoopGuardMarker(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${LOOP_GUARD_PARAM}=1`;
}
