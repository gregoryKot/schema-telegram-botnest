import type { NextFunction, Request, Response } from 'express';
import { isLoopbackAddress, isPrivateAddress } from './trust-proxy';

/**
 * Выборка последних запросов для пробы самопроверки `clientIp`: доходит ли до
 * приложения настоящий адрес посетителя (`req.ip`), а не адрес прокси.
 *
 * Пассивная намеренно: запрос из контейнера на собственный публичный домен
 * идёт через docker-proxy и показал бы Caddy адрес шлюза 172.x, то есть
 * активная проба была бы красной по построению. Живой трафик не врёт.
 *
 * В буфере только булевы признаки, адреса не хранятся: журнал Caddy выключен
 * намеренно (deploy/vps/Caddyfile), и в памяти приложения адреса посетителей
 * тоже ни к чему. Выборка у каждого инстанса своя; проба бежит на лидере и
 * видит трафик лидера. Заголовки CDN присылает кто угодно: подделка лишь красит
 * пробу (лишний DM по смене состояния), на безопасность не влияет.
 */
export interface IpSampleEntry {
  /** req.ip из частной сети: доверие к XFF не сработало или прокси стоит без XFF. */
  ipPrivate: boolean;
  /** req.ip совпал с адресом сокета: X-Forwarded-For не учтён. */
  ipIsSocket: boolean;
  /** Заголовки, которые ставит CDN перед прокси. */
  cdnMarked: boolean;
}

export interface IpSampleSummary {
  total: number;
  /** Записей с ipPrivate или ipIsSocket: адрес посетителя не дошёл. */
  unresolved: number;
  cdnMarked: number;
}

const CDN_HEADERS = [
  'cf-connecting-ip',
  'true-client-ip',
  'fastly-client-ip',
  'cdn-loop',
];

export const CLIENT_IP_SAMPLE_SIZE = 200;

export interface ClientIpSamplerOptions {
  size?: number;
  /** Адрес пира; подменяется в тесте, где сокет всегда loopback. */
  remoteAddress?: (req: Request) => string | undefined;
}

export function createClientIpSampler(opts: ClientIpSamplerOptions = {}) {
  const size = opts.size ?? CLIENT_IP_SAMPLE_SIZE;
  const peer = opts.remoteAddress ?? ((req) => req.socket?.remoteAddress);
  const ring: IpSampleEntry[] = [];
  let next = 0;

  function middleware(req: Request, _res: Response, done: NextFunction) {
    const socketIp = peer(req);
    // Loopback: HEALTHCHECK образа ходит на localhost:3000/health раз в минуту.
    if (socketIp && !isLoopbackAddress(socketIp) && req.ip) {
      ring[next] = {
        ipPrivate: isPrivateAddress(req.ip),
        ipIsSocket: req.ip === socketIp,
        cdnMarked: CDN_HEADERS.some((h) => req.headers[h] !== undefined),
      };
      next = (next + 1) % size;
    }
    done();
  }

  function summary(): IpSampleSummary {
    return {
      total: ring.length,
      unresolved: ring.filter((e) => e.ipPrivate || e.ipIsSocket).length,
      cdnMarked: ring.filter((e) => e.cdnMarked).length,
    };
  }

  return { middleware, summary };
}

const defaultSampler = createClientIpSampler();

/** Middleware для main.ts: ставится сразу после `trust proxy`. */
export const clientIpSampler = defaultSampler.middleware;
export const clientIpSummary = defaultSampler.summary;
