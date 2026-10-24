// Аудит 2026-10-11 («Мелочь»): Permissions-Policy не ставил никто — helmet 8
// этого заголовка не выставляет. Тест на шве (правило №14): заголовок
// собирают настоящие helmet и permissionsPolicy() — ровно то, что main.ts
// передаёт в app.use, — а запрос идёт через HTTP.
//
// Опасность у починки обратная: запрет функции ломает её молча (ни ошибки,
// ни 4xx — кнопка просто перестаёт работать). Поэтому список запретов
// сверяется с тем, что фронты реально зовут.
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { helmetOptions } from './helmet-config';
import {
  PERMISSIONS_POLICY_DENY,
  PERMISSIONS_POLICY_KEEP,
  permissionsPolicy,
  permissionsPolicyHeader,
} from './permissions-policy';
import {
  frontendSources,
  type SourceText,
} from '../test-support/frontend-sources';

// Признак в коде → функция Permissions-Policy, которую он требует.
const API_MARKERS: { feature: string; re: RegExp }[] = [
  { feature: 'web-share', re: /navigator\.(share|canShare)\b/ },
  { feature: 'clipboard-write', re: /navigator\.clipboard\b/ },
  { feature: 'identity-credentials-get', re: /use_fedcm|IdentityCredential/ },
  { feature: 'camera', re: /getUserMedia/ },
  { feature: 'microphone', re: /getUserMedia/ },
  { feature: 'display-capture', re: /getDisplayMedia/ },
  { feature: 'geolocation', re: /navigator\.geolocation\b/ },
  { feature: 'payment', re: /\bPaymentRequest\b/ },
  {
    feature: 'accelerometer',
    re: /new\s+(Accelerometer|LinearAccelerationSensor)\b|DeviceMotionEvent|['"]devicemotion['"]/,
  },
  {
    feature: 'gyroscope',
    re: /new\s+Gyroscope\b|DeviceOrientationEvent|['"]deviceorientation['"]/,
  },
  {
    feature: 'magnetometer',
    re: /new\s+Magnetometer\b|DeviceOrientationEvent|['"]deviceorientation['"]/,
  },
  { feature: 'bluetooth', re: /navigator\.bluetooth\b/ },
  { feature: 'hid', re: /navigator\.hid\b/ },
  { feature: 'serial', re: /navigator\.serial\b/ },
  { feature: 'usb', re: /navigator\.usb\b/ },
  { feature: 'midi', re: /requestMIDIAccess/ },
];

/** Какие функции требует код: функция → файлы, где нашёлся признак. */
function usedFeatures(sources: SourceText[]): Map<string, string[]> {
  const used = new Map<string, string[]>();
  for (const { feature, re } of API_MARKERS) {
    const paths = sources.filter((s) => re.test(s.text)).map((s) => s.path);
    if (paths.length > 0) used.set(feature, paths);
  }
  return used;
}

/** Запрещённое заголовком, но вызываемое кодом: `функция ← файлы`. */
function deniedButUsed(sources: SourceText[]): string[] {
  const deny = new Set<string>(PERMISSIONS_POLICY_DENY);
  return [...usedFeatures(sources)]
    .filter(([feature]) => deny.has(feature))
    .map(([feature, paths]) => `${feature} ← ${paths.join(', ')}`);
}

async function header(): Promise<string> {
  const app = express();
  app.use(helmet(helmetOptions()), permissionsPolicy());
  app.get('/', (_req, res) => {
    res.send('ok');
  });
  const res = await request(app).get('/').expect(200);
  // Соседний helmet не потерялся: оба слоя стоят в одной цепочке.
  expect(res.headers['content-security-policy']).toBeDefined();
  return String(res.headers['permissions-policy']);
}

describe('Permissions-Policy: заголовок и сверка с кодом', () => {
  const sources = frontendSources();

  it('ответ несёт заголовок: каждая запрещённая функция в форме x=()', async () => {
    const got = await header();
    expect(got).toBe(permissionsPolicyHeader());
    for (const f of PERMISSIONS_POLICY_DENY) expect(got).toContain(`${f}=()`);
    for (const f of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(got).toMatch(new RegExp(`(^|, )${f}=\\(\\)`));
    }
  });

  it('используемое кодом в заголовке не упомянуто вовсе', async () => {
    const got = await header();
    for (const f of Object.keys(PERMISSIONS_POLICY_KEEP)) {
      expect(got).not.toMatch(new RegExp(`(^|[ ,])${f}=`));
      expect(PERMISSIONS_POLICY_DENY).not.toContain(f);
    }
  });

  it('фронты не зовут ни одной запрещённой функции', () => {
    expect(sources.length).toBeGreaterThan(100);
    expect(deniedButUsed(sources)).toEqual([]);
  });

  it('каждая разрешённая функция и правда используется (запись не протухла)', () => {
    const used = usedFeatures(sources);
    for (const f of Object.keys(PERMISSIONS_POLICY_KEEP)) {
      expect([f, used.has(f)]).toEqual([f, true]);
    }
  });

  it('у каждой запрещённой функции есть признак в коде — иначе сверка слепа', () => {
    const marked = new Set(API_MARKERS.map((m) => m.feature));
    for (const f of PERMISSIONS_POLICY_DENY)
      expect([f, marked.has(f)]).toEqual([f, true]);
  });

  it('контроль: фронт, зовущий камеру, роняет сверку', () => {
    const fixture: SourceText[] = [
      {
        path: 'webapp/src/Fixture.tsx',
        text: 'await navigator.mediaDevices.getUserMedia({ video: true });',
      },
    ];
    expect(deniedButUsed(fixture)).toEqual([
      'camera ← webapp/src/Fixture.tsx',
      'microphone ← webapp/src/Fixture.tsx',
    ]);
    // А «Поделиться» запретом не считается: web-share разрешён.
    expect(
      deniedButUsed([{ path: 'a.ts', text: 'navigator.share({ url })' }]),
    ).toEqual([]);
  });
});
