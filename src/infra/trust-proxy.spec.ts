// Шов «X-Forwarded-For → req.ip» (правило №14): настоящий Express с тем же
// значением trust proxy, что стоит в main.ts, а не ручная подмена req.ip.
// Что Caddy без trusted_proxies (v2.5+) записывает в XFF адрес пира, а не
// пересылает клиентский, — свойство Caddy; его закрепляет подделанная цепочка
// ниже: даже если бы прокси переслал её, Express берёт правое значение.
import express from 'express';
import request from 'supertest';
import {
  TRUSTED_PROXY_HOPS,
  isLoopbackAddress,
  isPrivateAddress,
} from './trust-proxy';
import { createClientIpSampler } from './client-ip-sample';

describe('isPrivateAddress', () => {
  it.each([
    '172.18.0.3',
    '::ffff:10.0.0.5',
    '127.0.0.1',
    '::1',
    'fd00::1',
    '192.168.1.1',
    '169.254.1.1',
    '100.64.0.1',
    'fe80::1%eth0',
  ])('%s: частный', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '::ffff:93.184.216.34', '2a00:1450::1', '172.32.0.1'])(
    '%s: публичный',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it('не адрес и пусто: не частный', () => {
    expect(isPrivateAddress('garbage')).toBe(false);
    expect(isPrivateAddress(undefined)).toBe(false);
  });
});

describe('isLoopbackAddress', () => {
  it('127/8, ::1 и их v4-mapped форма — loopback; docker-сеть и публичные — нет', () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      expect(isLoopbackAddress(ip)).toBe(true);
    }
    for (const ip of ['172.18.0.3', '8.8.8.8', undefined]) {
      expect(isLoopbackAddress(ip)).toBe(false);
    }
  });
});

describe('trust proxy = TRUSTED_PROXY_HOPS на настоящем Express', () => {
  /** Сокет притворяется пиром из сети compose (supertest ходит с loopback). */
  function appBehindProxy(peer = '172.18.0.5') {
    const sampler = createClientIpSampler({ size: 10 });
    const app = express();
    app.set('trust proxy', TRUSTED_PROXY_HOPS);
    app.use((req, _res, next) => {
      Object.defineProperty(req.socket, 'remoteAddress', { value: peer });
      next();
    });
    app.use(sampler.middleware);
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    return { app, sampler };
  }

  it('один хоп доверия', () => {
    expect(TRUSTED_PROXY_HOPS).toBe(1);
  });

  it('XFF от прокси даёт адрес посетителя', async () => {
    const { app } = appBehindProxy();
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('подделанная цепочка: берётся правый адрес, подделка не проходит', async () => {
    const { app } = appBehindProxy();
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '6.6.6.6, 203.0.113.7');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('без XFF req.ip равен сокету, и выборка это помечает', async () => {
    const { app, sampler } = appBehindProxy();
    const res = await request(app).get('/ip');
    expect(res.body.ip).toBe('172.18.0.5');
    expect(sampler.summary()).toEqual({
      total: 1,
      unresolved: 1,
      cdnMarked: 0,
    });
  });

  it('нормальный запрос через прокси не попадает в «не дошёл»', async () => {
    const { app, sampler } = appBehindProxy();
    await request(app).get('/ip').set('X-Forwarded-For', '203.0.113.7');
    expect(sampler.summary()).toEqual({
      total: 1,
      unresolved: 0,
      cdnMarked: 0,
    });
  });

  it('метки CDN попадают в выборку', async () => {
    const { app, sampler } = appBehindProxy();
    await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7')
      .set('CF-Connecting-IP', '203.0.113.7');
    expect(sampler.summary().cdnMarked).toBe(1);
  });

  it('запрос с loopback-сокета (HEALTHCHECK образа) в выборку не идёт', async () => {
    const { app, sampler } = appBehindProxy('127.0.0.1');
    await request(app).get('/ip');
    expect(sampler.summary().total).toBe(0);
  });

  it('кольцо хранит последние size записей', async () => {
    const { app, sampler } = appBehindProxy();
    for (let i = 0; i < 13; i++) {
      await request(app).get('/ip').set('X-Forwarded-For', '203.0.113.7');
    }
    expect(sampler.summary().total).toBe(10);
  });
});
