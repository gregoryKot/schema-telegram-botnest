// Инвариант аудита 2026-10 (backend#21): onModuleInit не пишет массово в
// пользовательские таблицы. Он исполняется при КАЖДОМ рестарте процесса, а
// деплой — это рестарт, 4–6 раз в день. «Одноразовая» уборка
// `cancelAllPreReminders()` в onModuleInit молча отменяла отложенные
// напоминания всех людей при каждом деплое — с первого коммита проекта.
//
// Что запрещено при старте внутри onModuleInit: updateMany / deleteMany /
// cancelAll*. Разовые миграции данных — в prisma/migrations, а не в старте
// процесса. Гейт рождается с нулём нарушений; исключений нет (правило №15: не
// замалчивать). Граница проверки — тело метода: косвенный вызов
// (onModuleInit → this.cleanup() → updateMany) тест не видит.
//
// Тот же класс вовне — сообщения: sendMessage / notifyAdmin* (аудит 2026-10,
// «Супервизор контейнера»). «🚀 Деплой завершён» уходил из onModuleInit
// TelegramService при каждом рестарте, ещё до listen: крашлуп слал его на
// каждом круге. DM о старте живёт в src/telegram/start-announce.ts и
// зовётся из main.ts после listen. Сообщение в колбэке хендлера законно.
import { readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import * as ts from 'typescript';
import { collectSourceFiles } from '../../security/collect-source-files';

const SRC = join(__dirname, '..', '..');

/**
 * Регистрация хендлеров (`bot.action(…, async () => {…})`): тело колбэка
 * исполняется позже, по действию человека, а не при старте процесса. Оно
 * законно может звать cancelAll* — например, «выключил уведомления».
 */
const HANDLER_REGISTRARS = new Set([
  'action',
  'command',
  'on',
  'hears',
  'use',
  'catch',
]);

const FORBIDDEN_NAME =
  /^(?:updateMany|deleteMany|cancelAll\w*|sendMessage|notifyAdmin\w*)$/;

// Обход — общий collectSourceFiles (не заходит в скрытый src/.jest-cache, где
// параллельные воркеры jest пишут файлы прямо во время обхода — флак ENOENT).
function sourceFiles(dir: string): string[] {
  return collectSourceFiles(dir, {
    filter: (p) => !relative(dir, p).split(sep).includes('test-support'),
  });
}

/** Запрещённые имена, достижимые при СТАРТЕ из тела onModuleInit. */
function violations(code: string): string[] {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const scan = (node: ts.Node) => {
    if (ts.isIdentifier(node) && FORBIDDEN_NAME.test(node.text)) {
      found.push(node.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      HANDLER_REGISTRARS.has(node.expression.name.text)
    ) {
      scan(node.expression.expression);
      node.arguments
        .filter((a) => !ts.isFunctionLike(a))
        .forEach((a) => scan(a));
      return;
    }
    ts.forEachChild(node, scan);
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isMethodDeclaration(node) &&
      node.name.getText(sf) === 'onModuleInit' &&
      node.body
    ) {
      scan(node.body);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('onModuleInit не делает массовых записей и не пишет людям', () => {
  it('в src/** нет updateMany / deleteMany / cancelAll* / sendMessage / notifyAdmin* при старте', () => {
    const found = sourceFiles(SRC).flatMap((file) =>
      violations(readFileSync(file, 'utf8')).map(
        (v) => `${relative(SRC, file)}: ${v}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it('сканер видит onModuleInit сервисов (иначе проверка ничего не доказывает)', () => {
    const withInit = sourceFiles(SRC)
      .filter((f) => /\bonModuleInit\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(withInit).toEqual(
      expect.arrayContaining([
        'telegram/telegram.service.ts',
        'prisma/prisma.service.ts',
      ]),
    );
  });

  describe('контрольные образцы', () => {
    it('прежний блок «одноразовой уборки» краснеет', () => {
      const old = `class S { onModuleInit() {
        this.botService.cancelAllPreReminders().then(() => null);
      } }`;
      expect(violations(old)).toEqual(['cancelAllPreReminders']);
    });

    it.each(['updateMany', 'deleteMany'])(
      '%s в onModuleInit краснеет',
      (fn) => {
        const code = `class S { async onModuleInit() { await this.prisma.t.${fn}({}); } }`;
        expect(violations(code)).toEqual([fn]);
      },
    );

    it('чтение и точечная запись в onModuleInit законны', () => {
      const code = `class S { async onModuleInit() {
        await this.prisma.article.findUnique({ where: { slug: 'a' } });
        await this.prisma.article.update({ where: { slug: 'a' }, data: {} });
      } }`;
      expect(violations(code)).toEqual([]);
    });

    it('вызов в колбэке регистрации хендлера (исполнится по нажатию) законен', () => {
      const code = `class S { onModuleInit() {
        this.bot.action('off', async () => { await this.n.cancelAll(1); });
      } }`;
      expect(violations(code)).toEqual([]);
    });

    it('но тот же вызов в .then() при старте краснеет', () => {
      const code = `class S { onModuleInit() {
        this.bot.action('off', async () => null);
        void this.x.load().then(() => this.n.cancelAll(1));
      } }`;
      expect(violations(code)).toEqual(['cancelAll']);
    });

    it('прежний DM «Деплой завершён» из хвоста onModuleInit краснеет', () => {
      const old = `class S { onModuleInit() {
        this.launcher.start();
        const adminId = process.env.ADMIN_ID;
        if (adminId) {
          this.bot.telegram
            .sendMessage(adminId, '🚀 Деплой завершён')
            .catch((err) => this.logger.error('deploy DM failed', err));
        }
      } }`;
      expect(violations(old)).toEqual(['sendMessage']);
    });

    it.each(['notifyAdmin', 'notifyAdminWithFallback'])(
      '%s в onModuleInit краснеет',
      (fn) => {
        const code = `class S { async onModuleInit() { await this.t.${fn}('x'); } }`;
        expect(violations(code)).toEqual([fn]);
      },
    );

    it('sendMessage в колбэке хендлера (ответ на нажатие) законен', () => {
      const code = `class S { onModuleInit() {
        this.bot.action('ping', async (ctx) => {
          await this.bot.telegram.sendMessage(ctx.chat.id, 'pong');
        });
      } }`;
      expect(violations(code)).toEqual([]);
    });

    it('updateMany в ДРУГОМ методе не считается (гейт про onModuleInit)', () => {
      const code = `class S {
        onModuleInit() {}
        async cron() { await this.prisma.t.updateMany({}); }
      }`;
      expect(violations(code)).toEqual([]);
    });
  });
});
