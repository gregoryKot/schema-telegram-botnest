// Правила храповика нулей: что считается «почти нулём» и чем подтверждается
// причина «покрыто e2e». Движок — check-zero-coverage.mjs; правила вынесены,
// чтобы он не рос (правило №10).
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { compare, e2eTokens } from './check-e2e-in-ci.mjs';

// Без логики по построению: Nest-модуль (`*.module.ts` — один декоратор
// `@Module`) и точка входа `src/main.ts` поднимаются e2e-смоком на AppModule,
// который в этот подсчёт не входит.
export const EXEMPT_PATTERNS = [/\.module\.ts$/, /^src\/main\.ts$/];

// Порог «почти ноля», % строк: одна покрытая строка из десяти — тот же файл
// без тестов, а сумма и полы каталогов (check-coverage-ratchet) его не видят.
export const NEAR_ZERO_PCT = 10;

export const CI_WORKFLOW = '.github/workflows/ci.yml';
// Путь спека в причине — так, как его пишет e2e-шаг ci.yml.
const SPEC_RE = /(?<![\w./-])test\/[\w./-]+\.e2e-spec\.ts/g;

/** Файлы src/** с исполняемыми строками и долей покрытых ниже порога, по пути. */
export function lowFiles(summary, root) {
  return Object.entries(summary)
    .filter(([p]) => p !== 'total')
    .map(([p, e]) => ({
      rel: p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p,
      covered: e.lines.covered,
      total: e.lines.total,
    }))
    .filter((f) => f.rel.startsWith('src/') && f.total > 0)
    .filter((f) => f.covered * 100 < NEAR_ZERO_PCT * f.total)
    .filter((f) => !EXEMPT_PATTERNS.some((re) => re.test(f.rel)))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

function ciE2eTokens(root) {
  try {
    return e2eTokens(readFileSync(join(root, CI_WORKFLOW), 'utf8'));
  } catch {
    return []; // нет ci.yml — e2e не гоняется вовсе, каждая заявка красная
  }
}

/**
 * Причина со словом «e2e» — заявка «покрыто e2e», а e2e в этот подсчёт не
 * входит. Верим ей, только если она называет спек, файл спека есть и его
 * гоняет e2e-шаг ci.yml (разбор и семантика «путь содержит токен» — из
 * check-e2e-in-ci.mjs): иначе удалённый или выпавший из CI спек держал бы
 * запись зелёной навсегда.
 */
export function e2eClaimProblems(baseline, root) {
  const claims = Object.entries(baseline).filter(([, r]) => /e2e/i.test(String(r)));
  if (!claims.length) return [];
  const tokens = ciE2eTokens(root);
  return claims.flatMap(([file, reason]) => {
    const specs = String(reason).match(SPEC_RE) ?? [];
    if (!specs.length) {
      return [`бейслайн ${file}: причина ссылается на e2e, но не называет спек test/…e2e-spec.ts`];
    }
    return specs.flatMap((spec) => {
      if (!existsSync(join(root, spec))) return [`бейслайн ${file}: спека ${spec} нет в репозитории`];
      if (compare([spec], tokens).orphans.length) {
        return [`бейслайн ${file}: ${spec} не гоняет ни один e2e-шаг ${CI_WORKFLOW}`];
      }
      return [];
    });
  });
}
