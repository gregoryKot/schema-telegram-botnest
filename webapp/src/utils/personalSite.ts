import { isPracticeHost } from './domainChrome';

// Какой из двух сайтов бандла рисовать (App.tsx: personalRoutes или appRoutes).
// S15 (аудит 2026-11): `?site=personal` на schemehappens.ru включал визитку — и
// её счётчик Метрики — у вошедшего человека на продуктовом хосте. На проде
// визитку включает только её хост (`isPracticeHost`). Параметр остался там,
// где без него нечем открыть визитку: `vite dev` (DEV) и петля 127.0.0.1 /
// localhost — браузерный смок гоняет собранный бандл через `vite preview`
// (e2e-browser/public-pages.spec.ts).
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function resolvePersonalSite(hostname: string, search: string, dev: boolean): boolean {
  if (isPracticeHost(hostname)) return true;
  if (!dev && !LOOPBACK_HOSTS.has(hostname)) return false;
  return new URLSearchParams(search).get('site') === 'personal';
}
