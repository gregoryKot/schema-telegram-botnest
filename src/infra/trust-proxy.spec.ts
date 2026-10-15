// Шов «X-Forwarded-For → req.ip» (правило №14): предусловие в проде создаёт
// не тест, а deploy/front-server.mjs. Все запросы входят в Nest через его
// TCP-проброс, и сокет у приложения всегда 127.0.0.1. Поэтому front поднят
// настоящим процессом (как в контейнере), перед настоящим Express с тем же
// значением trust proxy, что в main.ts.
// Что Caddy без trusted_proxies (v2.5+) записывает в XFF адрес пира, а не
// пересылает клиентский, — свойство Caddy; его закрепляет подделанная цепочка
// ниже: даже если бы прокси переслал её, Express берёт правое значение.
import { spawn, ChildProcess } from 'child_process';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';
import express from 'express';
import request from 'supertest';
import { TRUSTED_PROXY_HOPS, isPrivateAddress } from './trust-proxy';
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

describe('trust proxy = TRUSTED_PROXY_HOPS за настоящим front-server', () => {
  const procs: ChildProcess[] = [];
  const servers: Server[] = [];
  afterEach(async () => {
    while (procs.length) procs.pop()?.kill('SIGKILL');
    await Promise.all(
      servers
        .splice(0)
        .map((s) => new Promise<void>((r) => s.close(() => r()))),
    );
  });

  /** Express на эфемерном порту + настоящий front перед ним; отдаёт URL front. */
  async function behindFront(hops: number) {
    const sampler = createClientIpSampler(10);
    const app = express();
    app.set('trust proxy', hops);
    app.use(sampler.middleware);
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
    const appPort = (server.address() as AddressInfo).port;
    const front = spawn(
      'node',
      [join(process.cwd(), 'deploy/front-server.mjs')],
      {
        env: { ...process.env, PORT: '0', APP_PORT: String(appPort) },
      },
    );
    procs.push(front);
    const frontPort = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('front не поднялся')),
        5000,
      );
      front.stderr?.on('data', (buf: Buffer) => {
        const m = /поднят на порту (\d+)/.exec(buf.toString());
        if (!m) return;
        clearTimeout(timer);
        resolve(Number(m[1]));
      });
    });
    return { url: `http://127.0.0.1:${frontPort}`, sampler };
  }

  it('один хоп доверия', () => {
    expect(TRUSTED_PROXY_HOPS).toBe(1);
  });

  it('запрос с XFF от прокси: req.ip посетителя, в выборке «дошёл»', async () => {
    const { url, sampler } = await behindFront(TRUSTED_PROXY_HOPS);
    const res = await request(url)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7')
      .set('X-Forwarded-Proto', 'https');
    expect(res.body.ip).toBe('203.0.113.7');
    expect(sampler.summary()).toEqual({
      total: 1,
      unresolved: 0,
      cdnMarked: 0,
    });
  });

  it('подделанная цепочка: берётся правый адрес, подделка не проходит', async () => {
    const { url } = await behindFront(TRUSTED_PROXY_HOPS);
    const res = await request(url)
      .get('/ip')
      .set('X-Forwarded-For', '6.6.6.6, 203.0.113.7');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('запрос без X-Forwarded-* (HEALTHCHECK образа) в выборку не идёт', async () => {
    const { url, sampler } = await behindFront(TRUSTED_PROXY_HOPS);
    const res = await request(url).get('/ip');
    expect(res.body.ip).toBe('127.0.0.1');
    expect(sampler.summary().total).toBe(0);
  });

  it('trust proxy 0: XFF пришёл, а req.ip остался адресом сокета — «не дошёл»', async () => {
    const { url, sampler } = await behindFront(0);
    const res = await request(url)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');
    expect(res.body.ip).toBe('127.0.0.1');
    expect(sampler.summary()).toEqual({
      total: 1,
      unresolved: 1,
      cdnMarked: 0,
    });
  });

  it('метки CDN попадают в выборку', async () => {
    const { url, sampler } = await behindFront(TRUSTED_PROXY_HOPS);
    await request(url)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7')
      .set('CF-Connecting-IP', '203.0.113.7');
    expect(sampler.summary().cdnMarked).toBe(1);
  });

  it('кольцо хранит последние size записей, счётчики не уходят в минус', async () => {
    const { url, sampler } = await behindFront(0);
    for (let i = 0; i < 13; i++) {
      await request(url)
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.7')
        .set('CF-Connecting-IP', '203.0.113.7');
    }
    expect(sampler.summary()).toEqual({
      total: 10,
      unresolved: 10,
      cdnMarked: 10,
    });
  });
});
