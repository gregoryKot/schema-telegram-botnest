// Единое имя бота во всех источниках репозитория (правило №4, аудит 2026-10,
// infra#18). Имя бота живёт в нескольких местах, которые никто не сверял:
// Dockerfile (сборка webapp), .env.production мини-аппа, статика вне исходников
// (add-icon.html, llms.txt) и env сборок в CI. Разъезд = ссылки на двух разных
// ботов в одном продукте. Бэкендовое BOT_USERNAME репозиторию недоступно — его
// сверяет с токеном проба самопроверки `telegram` (probe-telegram.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import { checkTelegramUsername } from '../../infra/env-registry.username';

const ROOT = join(__dirname, '..', '..', '..');

/** Файл → как достать из него имена бота (все вхождения). */
const EXTRACTORS: Record<string, RegExp> = {
  Dockerfile: /^ENV VITE_BOT_USERNAME=(\S+)/gm,
  'schema-miniapp/.env.production': /^VITE_BOT_USERNAME=(\S+)/gm,
  'webapp/public/add-icon.html': /t\.me\/([A-Za-z0-9_]+)\/diary/g,
  'webapp/public/llms.txt': /Telegram-бот: @([A-Za-z0-9_]+)/g,
  '.github/workflows/ci.yml': /VITE_BOT_USERNAME: (\S+)/g,
  '.github/workflows/nightly.yml': /VITE_BOT_USERNAME: (\S+)/g,
};

function collectBotNames(
  read: (file: string) => string,
): { file: string; name: string }[] {
  const found: { file: string; name: string }[] = [];
  for (const [file, re] of Object.entries(EXTRACTORS)) {
    for (const m of read(file).matchAll(re)) found.push({ file, name: m[1] });
  }
  return found;
}

const readReal = (file: string) => readFileSync(join(ROOT, file), 'utf8');

describe('имя бота совпадает во всех источниках репозитория', () => {
  const sources = collectBotNames(readReal);

  it('в каждом файле имя найдено (иначе извлекатель устарел и ничего не сверяет)', () => {
    for (const file of Object.keys(EXTRACTORS)) {
      expect(sources.some((s) => s.file === file)).toBe(true);
    }
  });

  it('все имена одинаковы', () => {
    expect(new Set(sources.map((s) => s.name)).size).toBe(1);
  });

  it('имя проходит формат Telegram и не равно старому боту', () => {
    for (const { name } of sources) {
      expect(checkTelegramUsername(name)).toBeNull();
      expect(name).not.toBe('SchemaLabBot');
    }
  });

  it('контрольный: подмена имени в одном источнике делает множество неоднородным', () => {
    const tampered = collectBotNames((file) =>
      file === 'webapp/public/add-icon.html'
        ? readReal(file).replace(/SchemeHappensBot/g, 'SchemaLabBot')
        : readReal(file),
    );
    expect(new Set(tampered.map((s) => s.name)).size).toBeGreaterThan(1);
  });
});

// Плагин-guard (shared/src/build/requireBotUsername.ts) в dead-files-baseline
// записан как «потребитель — vite.config». Запись не должна быть ложью.
describe('vite-конфиги обоих фронтендов подключают guard имени бота', () => {
  it.each(['webapp/vite.config.ts', 'schema-miniapp/vite.config.ts'])(
    '%s импортирует и вызывает requireBotUsernamePlugin',
    (file) => {
      const text = readReal(file);
      expect(text).toContain('shared/src/build/requireBotUsername');
      expect(text).toContain('requireBotUsernamePlugin()');
    },
  );
});
