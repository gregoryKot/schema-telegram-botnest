// Белый список полей аудит-события (аудит 2026-07-20, L6).
//
// Две группы тестов, и ни одна не заменяет другую:
//   1. ОБА исхода вычистки — секрет под произвольным именем заглушён И
//      разрешённое поле дошло до лога целым. Второе не формальность: белый
//      список, который глушит всё, «проходит» проверку на утечку и делает
//      аудит-след бесполезным — а бесполезному следу перестают верить и
//      выключают его (правило №15 п.4 CLAUDE.md).
//   2. СВЕРКА списка с call sites (правило №4: два места, обязанные
//      совпадать, фиксируются тестом). Белый список — не счётчик, а
//      классификация: гейт обязан краснеть и на незарегистрированном ключе
//      (значение молча уехало в `[redacted]`), и на протухшей записи,
//      которую больше никто не передаёт.
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { LOGGABLE_FIELDS, redactSecurityLogData } from './security-log-redact';

describe('redactSecurityLogData — секрет под любым именем не проходит', () => {
  // Имена, под которыми секрет приезжает в реальности. Старый чёрный список
  // ловил только первые четыре; остальные проходили насквозь — в stdout и в
  // DM владельцу (AlertLogger), ср. PR #127.
  const SECRET_KEYS = [
    'accessToken',
    'password',
    'apiSecret',
    'initData',
    // Класс, невидимый для чёрного списка подстрок:
    'code', // OAuth authorization code
    'state', // OAuth state (double-submit)
    'verifier', // PKCE code_verifier
    'sig',
    'hash', // подпись initData
    'signature',
    'assertion', // JWT-bearer / SAML
    'otp',
    'cookie',
    'providerId',
    'authorization',
  ];

  it.each(SECRET_KEYS)('поле %s заглушено, значение не утекает', (key) => {
    const out = redactSecurityLogData({ [key]: 'LEAKED-VALUE-42' });
    expect(out[key]).toBe('[redacted]');
    expect(JSON.stringify(out)).not.toContain('LEAKED-VALUE-42');
  });

  it('вложенный секрет внутри РАЗРЕШЁННОГО поля тоже заглушён', () => {
    // Тот же класс, что секрет под чужим именем: белое поле — не ворота.
    const out = redactSecurityLogData({
      detail: { reason: 'conflict', hash: 'LEAKED-VALUE-42' },
    });
    expect(JSON.stringify(out)).not.toContain('LEAKED-VALUE-42');
    // …и при этом разрешённый сосед внутри того же объекта цел.
    expect(out.detail).toEqual({ reason: 'conflict', hash: '[redacted]' });
  });

  it('секрет в массиве под разрешённым полем заглушён', () => {
    const out = redactSecurityLogData({
      detail: [{ token: 'LEAKED-VALUE-42' }],
    });
    expect(JSON.stringify(out)).not.toContain('LEAKED-VALUE-42');
  });

  it('глубоко вложенное значение глушится целиком, без бесконечного спуска', () => {
    const deep = { detail: { detail: { detail: { detail: { ip: 'x' } } } } };
    expect(() => redactSecurityLogData(deep)).not.toThrow();
    expect(JSON.stringify(redactSecurityLogData(deep))).toContain('[redacted]');
  });
});

describe('redactSecurityLogData — разрешённое поле доходит целым', () => {
  // Контрольная сторона: без неё «вычистить всё» прошло бы как починка.
  it('значения разрешённых полей не тронуты', () => {
    const out = redactSecurityLogData({
      userId: 5,
      ip: '203.0.113.7',
      provider: 'google',
      reason: 'bad_hash',
      sourceLive: true,
      suppressed: 0,
    });
    expect(out).toEqual({
      userId: 5,
      ip: '203.0.113.7',
      provider: 'google',
      reason: 'bad_hash',
      sourceLive: true,
      suppressed: 0,
    });
  });

  it('bigint приводится к строке (JSON.stringify на нём бросает)', () => {
    const out = redactSecurityLogData({ userId: 123_456_789_012_345n });
    expect(out.userId).toBe('123456789012345');
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it('null/undefined/0/"" сохраняются как есть, а не превращаются в заглушку', () => {
    // Мутация «falsy → [redacted]» иначе прошла бы незамеченной, а `ip: null`
    // (запрос без адреса) — законное значение, которое админу нужно видеть.
    const out = redactSecurityLogData({
      ip: null,
      ua: undefined,
      suppressed: 0,
      reason: '',
    });
    expect(out).toEqual({ ip: null, ua: undefined, suppressed: 0, reason: '' });
  });

  it('имя разрешённого поля в другом регистре НЕ разрешено (контрольный случай)', () => {
    // Список сверяется точным именем: `UserID` — не `userId`, и подстрочный
    // матч сюда не возвращается.
    expect(redactSecurityLogData({ UserID: 5 }).UserID).toBe('[redacted]');
  });

  it('не-простой объект (Date) не разбирается на ключи и доходит целым', () => {
    // Спуск по ключам осмыслен только для «мешка данных». Date, разобранный
    // как объект, стал бы `{}` — в DM вместо времени события пустота.
    const at = new Date('2026-07-20T10:00:00.000Z');
    expect(redactSecurityLogData({ detail: at }).detail).toBe(at);
  });

  it('объект без прототипа разбирается как обычный — секрет внутри не проходит', () => {
    // `Object.create(null)` — такой же мешок данных (так приходят, например,
    // разобранные query/заголовки). Если бы он не считался «простым», секрет
    // внутри уехал бы в лог целиком.
    const bag = Object.create(null) as Record<string, unknown>;
    bag.hash = 'LEAKED-VALUE-42';
    bag.reason = 'bad_sig';
    const out = redactSecurityLogData({ detail: bag });
    expect(JSON.stringify(out)).not.toContain('LEAKED-VALUE-42');
    expect(out.detail).toEqual({ hash: '[redacted]', reason: 'bad_sig' });
  });

  it('примитив на предельной глубине доживает до лога, глушится только контейнер', () => {
    // Потолок глубины — защита от бесконечного спуска, а не повод терять
    // значение: на границе глушим вложенный объект/массив, скаляр оставляем.
    const out = redactSecurityLogData({
      detail: { detail: { detail: { reason: 'deep', detail: { ip: 'x' } } } },
    });
    const deepest = (
      (out.detail as Record<string, unknown>).detail as Record<string, unknown>
    ).detail as Record<string, unknown>;
    expect(deepest.reason).toBe('deep');
    expect(deepest.detail).toBe('[redacted]');
  });
});

// ─── Сверка белого списка с реальными call sites ─────────────────────────────

const SRC = join(__dirname, '..');

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) tsFiles(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts'))
      out.push(p);
  }
  return out;
}

/** Конец строкового литерала, начинающегося на `i` (с учётом escape). */
function endOfString(src: string, i: number): number {
  const quote = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') j++;
    else if (src[j] === quote) return j;
  }
  return src.length;
}

/**
 * Разбор объектного литерала, начинающегося с `{` на позиции `open`.
 * Строки и комментарии пропускаются — иначе запятая внутри текста
 * (`hint: 'открыт, но подписи нет'`) рвала бы литерал на части.
 */
function scanObject(
  src: string,
  open: number,
): { keys: string[]; end: number } {
  const segments: string[] = [];
  let depth = 0;
  let segStart = open + 1;
  let end = src.length;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      i = endOfString(src, i);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl < 0 ? src.length : nl;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i) + 1;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) {
        segments.push(src.slice(segStart, i));
        end = i;
        break;
      }
    } else if (c === ',' && depth === 1) {
      segments.push(src.slice(segStart, i));
      segStart = i + 1;
    }
  }
  const keys: string[] = [];
  for (const seg of segments) {
    const t = seg.trim();
    if (!t) continue;
    if (t.startsWith('...')) {
      // `...(cond ? { suppressed } : {})` — ключи живут во вложенных литералах.
      for (let j = 0; j < t.length; j++) {
        if (t[j] === '{') {
          const inner = scanObject(t, j);
          keys.push(...inner.keys);
          j = inner.end;
        }
      }
      continue;
    }
    const m = /^([A-Za-z_$][\w$]*)\s*(:|$)/.exec(t);
    // Несопоставимый сегмент (вычисляемый ключ `[k]: v`) — не «ничего не
    // нашли», а неизвестный гейту случай: пусть краснеет, а не молчит.
    keys.push(m ? m[1] : `<не разобрано: ${t.slice(0, 40)}>`);
  }
  return { keys, end };
}

/** Все `securityLog.log('event', { … })` в бэкенде, с ключами объекта. */
function callSiteKeys(): { keys: Map<string, string[]>; broken: string[] } {
  const keys = new Map<string, string[]>();
  const broken: string[] = [];
  // Приёмник всегда назван `securityLog` (this./deps./sinks./необязательный).
  const CALL = /securityLog\s*\??\.\s*log\(\s*'([a-z_]+)'\s*,\s*/g;
  for (const file of tsFiles(SRC)) {
    const src = readFileSync(file, 'utf8');
    const where = relative(SRC, file);
    let m: RegExpExecArray | null;
    CALL.lastIndex = 0;
    while ((m = CALL.exec(src))) {
      const at = m.index + m[0].length;
      if (src[at] !== '{') {
        // Данные собраны переменной — ключи гейту не видны. Это слепая зона,
        // а не «нет нарушений»: инлайни литерал или расширь разбор.
        broken.push(`${where} [${m[1]}]`);
        continue;
      }
      for (const k of scanObject(src, at).keys) {
        if (!keys.has(k)) keys.set(k, []);
        keys.get(k)!.push(`${where} [${m[1]}]`);
      }
    }
  }
  return { keys, broken };
}

describe('LOGGABLE_FIELDS сверен с call sites', () => {
  const { keys, broken } = callSiteKeys();

  it('разбор нашёл call sites (иначе сверка ниже вечнозелёная)', () => {
    // Контроль самого инструмента: сломанный сканер молча пропускает всё.
    expect(keys.size).toBeGreaterThan(20);
  });

  it('все call sites передают инлайновый литерал — слепых зон нет', () => {
    expect(broken).toEqual([]);
  });

  it('каждый передаваемый ключ зарегистрирован в белом списке', () => {
    const unlisted = [...keys]
      .filter(([k]) => !LOGGABLE_FIELDS.has(k))
      .map(([k, at]) => `${k} (${at[0]})`);
    // Незарегистрированный ключ не «протечёт» — он уедет в `[redacted]`, то
    // есть владелец недополучит данных в аудит-следе и в DM.
    expect(unlisted).toEqual([]);
  });

  it('в белом списке нет протухших записей', () => {
    const stale = [...LOGGABLE_FIELDS].filter((k) => !keys.has(k));
    // Протухшая запись — не уборка, а сигнал «сверься, что произошло»:
    // поле перестали передавать или переименовали (правило №11/№16).
    expect(stale).toEqual([]);
  });
});
