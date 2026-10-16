import { BlockList, isIP } from 'net';

/**
 * Сколько прокси стоит между пользователем и Express (`app.set('trust proxy')`).
 *
 * Ровно один HTTP-хоп: Caddy на VPS (deploy/vps/Caddyfile) либо прокси Amvera.
 * TCP-проброс deploy/front-server.mjs перед приложением хопом не считается: он
 * не разбирает HTTP, XFF не трогает, а сокет у приложения из-за него всегда
 * 127.0.0.1, поэтому по адресу сокета о прокси судить нельзя. Не `true`:
 * тогда Express верил бы самому левому адресу в X-Forwarded-For, а его
 * присылает клиент, и IP-бакеты троттлинга (правило №5) обходились бы
 * подделкой заголовка. Caddy без `trusted_proxies` (v2.5+) не верит
 * XFF клиента и записывает в него адрес пира, поэтому самое правое значение
 * цепочки — настоящий посетитель. Это верно, пока приложение не опубликовано
 * наружу (`expose`, не `ports`, в deploy/vps/docker-compose.yml) и нет CDN.
 *
 * Появился CDN (например, оранжевое облако Cloudflare в панели DNS): Caddy
 * увидит пиром адрес CDN, и все IP-бакеты схлопнутся в адреса CDN. Тогда
 * нужны `trusted_proxies` в Caddyfile и значение 2. Число и Caddyfile
 * сверяет src/infra/vps-caddyfile.spec.ts, живой трафик — проба самопроверки
 * `clientIp` (src/infra/self-check/probe-client-ip.ts).
 */
export const TRUSTED_PROXY_HOPS = 1;

const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['100.64.0.0', 10],
] as const) {
  PRIVATE.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  PRIVATE.addSubnet(net, prefix, 'ipv6');
}

/** Приводит `::ffff:a.b.c.d` к `a.b.c.d`, отбрасывает зону `%eth0`. */
function normalize(ip: string): string {
  const bare = ip.split('%')[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(bare);
  return mapped ? mapped[1] : bare;
}

function inList(list: BlockList, ip: string | undefined): boolean {
  if (!ip) return false;
  const addr = normalize(ip);
  const family = isIP(addr);
  if (family === 0) return false;
  return list.check(addr, family === 4 ? 'ipv4' : 'ipv6');
}

/** Адрес из частной сети, loopback, link-local или CGNAT: не посетитель из интернета. */
export function isPrivateAddress(ip: string | undefined): boolean {
  return inList(PRIVATE, ip);
}
