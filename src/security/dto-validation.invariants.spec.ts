// Security-трипваер: НИ ОДИН @Body() не уходит в прод без рантайм-валидации
// (правило №6 CLAUDE.md, этап 2.6 TEST_IMPROVEMENT_PLAN.md). Inline-тип
// (`Record<string, unknown>`, одиночное поле `@Body('x') x: string`, локальный
// `interface`) даёт только compile-time иллюзию — глобальный
// ValidationPipe({ whitelist: true }) применяется лишь к class-инстансам с
// class-validator декораторами. Инвариант: каждый @Body() без параметра
// (`@Body() x: T`) обязан типизироваться классом, который (а) объявлен в
// dto-файле (путь/имя содержит `dto`) И (б) в этом файле есть хотя бы один
// class-validator декоратор — иначе это нарушение, допустимое только через
// VIOLATIONS_LEGACY (список может только СОКРАЩАТЬСЯ).
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectSourceFiles } from './collect-source-files';

const SRC = join(__dirname, '..');

const ALL_TS = collectSourceFiles(SRC);
const CONTROLLERS = ALL_TS.filter((p) => p.endsWith('.controller.ts'));

// Ловит `@Body() body: TypeName` / `@Body() body: Record<string, unknown>` /
// `@Body('field') field: string` — и на одной строке, и с параметром на
// следующей. Generic вида `Foo<Bar, Baz>` берётся одним уровнем вложенности
// (достаточно для реальных Record<K, V> в этом кодбейзе).
const BODY_RE =
  /@Body\(\s*(?:'([^']+)')?\s*\)\s*\n?\s*\w+\s*:\s*(\w+(?:<[^>]*>)?)/g;

const VALIDATOR_RE =
  /@(Is[A-Z]\w*|Length|Max|Min|Matches|ValidateNested|ArrayMaxSize|ArrayMinSize|ArrayNotEmpty)\(/;

// Индекс `class Name` / `interface Name` по всему src — чтобы разрешить имя
// типа из @Body() до файла-определения (одноимённые классы в разных файлах
// в проекте не встречаются; при коллизии побеждает первое найденное).
interface TypeInfo {
  file: string;
  kind: 'class' | 'interface';
}
function buildTypeIndex(): Map<string, TypeInfo> {
  const idx = new Map<string, TypeInfo>();
  const classRe = /(?:export\s+)?class\s+(\w+)/g;
  const ifaceRe = /(?:export\s+)?interface\s+(\w+)/g;
  for (const f of ALL_TS) {
    const src = readFileSync(f, 'utf8');
    let m: RegExpExecArray | null;
    classRe.lastIndex = 0;
    while ((m = classRe.exec(src)))
      if (!idx.has(m[1])) idx.set(m[1], { file: f, kind: 'class' });
    ifaceRe.lastIndex = 0;
    while ((m = ifaceRe.exec(src)))
      if (!idx.has(m[1])) idx.set(m[1], { file: f, kind: 'interface' });
  }
  return idx;
}

// Инлайновые/примитивные типы — точно не DTO-класс.
const INLINE_TYPE_RE =
  /^(Record<|string$|number$|boolean$|unknown$|any$|object$)/;

interface BodyUsage {
  rel: string;
  line: number;
  reason: string;
}

function scanViolations(): BodyUsage[] {
  const typeIndex = buildTypeIndex();
  const violations: BodyUsage[] = [];
  for (const f of CONTROLLERS) {
    const src = readFileSync(f, 'utf8');
    const rel = f.replace(SRC + '/', '');
    let m: RegExpExecArray | null;
    BODY_RE.lastIndex = 0;
    while ((m = BODY_RE.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      const field = m[1];
      const type = m[2];
      if (field) {
        violations.push({
          rel,
          line,
          reason: `одиночное поле @Body('${field}')`,
        });
        continue;
      }
      if (INLINE_TYPE_RE.test(type)) {
        violations.push({ rel, line, reason: `inline-тип ${type}` });
        continue;
      }
      const info = typeIndex.get(type);
      if (!info) {
        violations.push({ rel, line, reason: `тип ${type} не найден` });
        continue;
      }
      if (info.kind !== 'class') {
        violations.push({
          rel,
          line,
          reason: `${type} — interface, не class (${info.file})`,
        });
        continue;
      }
      if (!/dto/i.test(info.file)) {
        violations.push({
          rel,
          line,
          reason: `${type} не в dto-файле (${info.file})`,
        });
        continue;
      }
      const dtoSrc = readFileSync(info.file, 'utf8');
      if (!VALIDATOR_RE.test(dtoSrc)) {
        violations.push({
          rel,
          line,
          reason: `${type} без class-validator декораторов (${info.file})`,
        });
      }
    }
  }
  return violations;
}

function countBodyParams(): number {
  let total = 0;
  for (const f of CONTROLLERS) {
    const src = readFileSync(f, 'utf8');
    BODY_RE.lastIndex = 0;
    while (BODY_RE.exec(src)) total++;
  }
  return total;
}

// Текущие нарушители (собраны сканом на 2026-07-27). Путь+строка — новый
// рефакторинг рядом может сдвинуть номер строки; в этом случае запись просто
// обновляется вместе с рефактором, а не удаляется втихую. Список может
// только СОКРАЩАТЬСЯ — чинить нарушителя (завести DTO) и убрать отсюда.
// Список сокращён аудитом 2026-08 (L4): единичные @Body('email'/'token'/
// 'initData') в auth-account/auth-2fa переведены на EmailBodyDto/TokenBodyDto/
// InitDataBodyDto, а inline DonateDto/SubscribeDto — на class-DTO. Записи убраны
// (список может только СОКРАЩАТЬСЯ). auth-account Record сдвинут :231→:238 тем же
// L4-импортом. Остаются осознанные: два Telegram-payload'а (whitelist сломал бы
// hash-верификацию), вебхук Robokassa (подпись руками), и ручной Record
// api/tracker с проверкой по allowlist.
//
// Список сокращён ещё раз аудитом долга 2026-08-14: три записи переведены на
// class-DTO — api/api.controller.ts:115 (Record<string, unknown> → UserFlagsDto),
// api/booking.controller.ts:33 (interface BookingDto → class BookingDto в
// src/api/dto/booking.dto.ts), booking/booking-admin.controller.ts:172
// (interface CreateRuleDto в availability.service.ts → class CreateRuleDto в
// booking-admin.dto.ts). Планка ниже ужата с 9 до 6.
// Строка auth-account.controller.ts:242 — тот же нарушитель, что и раньше
// (inline Record<string, unknown> в telegram-widget merge); фикс device-code
// phishing 2026-08-31 убрал из контроллера инъекцию LoginTicketService, но
// номер строки после prettier совпал с прежним.
const VIOLATIONS_LEGACY: Record<string, string> = {
  'api/tracker.controller.ts:194':
    'inline-тип Record<string, number> (childhood-ratings) — ручная ' +
    'проверка по NEED_IDS в коде, но не DTO',
  'auth/auth-account.controller.ts:242':
    'inline-тип Record<string, unknown> (telegram widget merge) — ' +
    'комментарий в коде: whitelist сломает hash-верификацию Telegram',
  'auth/auth-telegram.controller.ts:45':
    'inline-тип Record<string, string> — подписанный Telegram-payload, ' +
    'whitelist срежет поля и сломает hash-верификацию (комментарий в коде)',
  'booking/payment.controller.ts:62':
    "одиночное поле @Body('OutSum') — вебхук Robokassa",
  'booking/payment.controller.ts:63':
    "одиночное поле @Body('InvId') — вебхук Robokassa",
  'booking/payment.controller.ts:64':
    "одиночное поле @Body('SignatureValue') — вебхук Robokassa, подпись " +
    'проверяется вручную в RobokassaService',
};

describe('трипваер: @Body() типизирован DTO с class-validator (правило №6)', () => {
  it('санити: найдено ≥10 @Body-параметров в контроллерах', () => {
    expect(countBodyParams()).toBeGreaterThanOrEqual(10);
  });

  it('новых нарушителей нет (все текущие — в VIOLATIONS_LEGACY)', () => {
    const violations = scanViolations();
    const newOnes = violations.filter(
      (v) => !(`${v.rel}:${v.line}` in VIOLATIONS_LEGACY),
    );
    expect(newOnes).toEqual([]);
  });

  it('VIOLATIONS_LEGACY не разросся сверх известного (может только сокращаться)', () => {
    expect(Object.keys(VIOLATIONS_LEGACY).length).toBeLessThanOrEqual(6);
  });
});
