import type { NextFunction, Request, Response } from 'express';
import { isPrivateAddress } from './trust-proxy';

/**
 * Выборка последних запросов для пробы самопроверки `clientIp`: доходит ли до
 * приложения настоящий адрес посетителя (`req.ip`), а не адрес прокси.
 *
 * Пассивная намеренно: запрос из контейнера на собственный публичный домен
 * идёт через docker-proxy и показал бы Caddy адрес шлюза 172.x, то есть
 * активная проба была бы красной по построению. Живой трафик не врёт.
 *
 * «Запрос пришёл через прокси» узнаётся по заголовкам, которые прокси ставит
 * всегда (`x-forwarded-for`, `x-forwarded-proto`), а не по адресу сокета: в
 * контейнере все запросы входят через TCP-проброс deploy/front-server.mjs, и
 * сокет у каждого 127.0.0.1. Запрос без этих заголовков (HEALTHCHECK образа,
 * localhost:3000/health) пришёл не через прокси и в выборку не идёт.
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
  /**
   * req.ip совпал с адресом сокета при пришедших X-Forwarded-* заголовках:
   * доверие к прокси не применилось (trust proxy 0). За front сокет всегда
   * 127.0.0.1, так что значим именно этот признак, а не адрес сокета сам по себе.
   */
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

/** Заголовки, которые ставит любой reverse-proxy перед приложением. */
const PROXY_HEADERS = ['x-forwarded-for', 'x-forwarded-proto'];

const hasAny = (req: Request, names: string[]) =>
  names.some((h) => req.headers[h] !== undefined);

export const CLIENT_IP_SAMPLE_SIZE = 200;

export function createClientIpSampler(size = CLIENT_IP_SAMPLE_SIZE) {
  const ring: IpSampleEntry[] = [];
  let next = 0;
  // Счётчики держатся вместе с кольцом, а не пересчитываются на каждый summary().
  const sums = { unresolved: 0, cdnMarked: 0 };
  const apply = (e: IpSampleEntry, sign: 1 | -1) => {
    if (e.ipPrivate || e.ipIsSocket) sums.unresolved += sign;
    if (e.cdnMarked) sums.cdnMarked += sign;
  };

  function middleware(req: Request, _res: Response, done: NextFunction) {
    if (hasAny(req, PROXY_HEADERS) && req.ip) {
      const old = ring[next];
      if (old) apply(old, -1);
      const entry: IpSampleEntry = {
        ipPrivate: isPrivateAddress(req.ip),
        ipIsSocket: req.ip === req.socket?.remoteAddress,
        cdnMarked: hasAny(req, CDN_HEADERS),
      };
      ring[next] = entry;
      apply(entry, 1);
      next = (next + 1) % size;
    }
    done();
  }

  function summary(): IpSampleSummary {
    return { total: ring.length, ...sums };
  }

  return { middleware, summary };
}

const defaultSampler = createClientIpSampler();

/** Middleware для main.ts: ставится сразу после `trust proxy`. */
export const clientIpSampler = defaultSampler.middleware;
export const clientIpSummary = defaultSampler.summary;
