// GET /api/history?days=N — query приходит строкой; DTO приводит к числу и
// держит потолок в год (правило №6). Раньше контроллер молча резал до 30.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import {
  HISTORY_MAX_DAYS,
  HistoryQueryDto,
  historyDays,
} from './history-query.dto';

// Тот же пайп, что глобально в main.ts: проверяем и приведение строки.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const parse = (query: Record<string, string>) =>
  pipe.transform(query, {
    type: 'query',
    metatype: HistoryQueryDto,
  }) as Promise<HistoryQueryDto>;

// Глубина в коде фронтенда: `.history(112)` или константа, которую туда
// передают (`TRACKER_DAYS = 365`, `historyDays = 30`).
const DEPTH_RES = [
  /\.history\(\s*(\d+)\s*\)/g,
  /\b(?:TRACKER_DAYS|historyDays)\s*=\s*(\d+)/g,
];
const depthsIn = (src: string): number[] =>
  DEPTH_RES.flatMap((re) => [...src.matchAll(re)].map((m) => Number(m[1])));

function frontendHistoryDepths(): { file: string; days: number }[] {
  const root = join(__dirname, '..', '..', '..');
  const out: { file: string; days: number }[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        for (const days of depthsIn(readFileSync(p, 'utf8')))
          out.push({ file: p.slice(root.length + 1), days });
      }
    }
  };
  for (const pkg of ['webapp/src', 'schema-miniapp/src', 'shared/src'])
    walk(join(root, pkg));
  return out;
}

describe('HistoryQueryDto', () => {
  it('без days — неделя', async () => {
    expect(historyDays(await parse({}))).toBe(7);
  });

  it('строка из query становится числом, год проходит целиком', async () => {
    const q = await parse({ days: String(HISTORY_MAX_DAYS) });
    expect(historyDays(q)).toBe(365);
  });

  it('карта активности (112 дней) больше не режется до месяца', async () => {
    expect(historyDays(await parse({ days: '112' }))).toBe(112);
  });

  // Правило №4: глубина, которую просят фронтенды, и потолок эндпоинта —
  // два места, обязанные совпадать. Раньше карта активности просила 112 дней
  // и молча получала 30; теперь лишнее — 400, и сверка ловит это до прода.
  it('ни один фронтенд не просит историю глубже потолка', () => {
    const asked = frontendHistoryDepths();
    expect(asked.length).toBeGreaterThanOrEqual(4); // парсер не ослеп
    expect(asked.filter((a) => a.days > HISTORY_MAX_DAYS)).toEqual([]);
  });

  it('контроль сверки: литерал и константа глубины распознаются', () => {
    expect(depthsIn('api.history(400)')).toEqual([400]);
    expect(depthsIn('const TRACKER_DAYS = 365;')).toEqual([365]);
    expect(depthsIn('api.history(days)')).toEqual([]);
  });

  it.each(['366', '0', '-1', '7.5', 'garbage'])(
    'days=%s — 400, а не тихая подмена',
    async (days) => {
      await expect(parse({ days })).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
