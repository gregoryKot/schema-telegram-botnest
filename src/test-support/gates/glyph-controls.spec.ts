// Тест гейта check-glyph-controls.mjs: контрол без имени из одного глифа,
// иконки или пустой (аудит 2026-10-11, «Доступность»). Класс уже закрывали
// волной aria-label (docs/archive/PROJECT_AUDIT_ADDENDUM.md:171) — без
// механизма, и он вернулся с новым кодом: тики шагов дневника и флеш-карты
// (`<div {...pressable(f)} />`), отмена формы «свой режим» с одной иконкой.
// jsx-a11y/control-has-associated-label этого не видит: глиф для правила —
// подпись, а роль из спреда pressable() ему не известна.
//
// Проверяет ОБА исхода: гейт краснеет на каждой форме класса и зеленеет на
// подписанных и на тех, где имя может прийти из содержимого (ложно-красный
// гейт отключают — правило №15).
import { mkdirSync, symlinkSync } from 'fs';
import { join } from 'path';
import { runGate, REAL_SCRIPTS_DIR } from './gate-sandbox';

const GATE = 'check-glyph-controls.mjs';
const OK = '✓ контролы без имени';

// В песочнице нет node_modules; гейт берёт typescript через createRequire —
// подкладываем настоящий пакет, как он лежит в CI.
const withTs = (tmp: string) => {
  mkdirSync(join(tmp, 'node_modules'), { recursive: true });
  symlinkSync(
    join(REAL_SCRIPTS_DIR, '..', 'node_modules', 'typescript'),
    join(tmp, 'node_modules', 'typescript'),
  );
};

const tsx = (jsx: string) =>
  `export const X = ({ f }: { f: () => void }) => (\n  ${jsx}\n);\n`;

function gate(files: Record<string, string>) {
  return runGate(GATE, files, { setup: withTs });
}

describe('check-glyph-controls.mjs — краснеет', () => {
  it.each([
    ['кнопка-стрелка', '<button onClick={f}>←</button>', '«←»'],
    ['pressable-div с крестиком', '<div {...pressable(f)}>×</div>', '«×»'],
    [
      'пустой pressable-тик',
      '<div className="tick" {...pressable(f)} />',
      'иконка/пусто',
    ],
    [
      'кнопка с одной иконкой',
      '<button onClick={f}><MMIcon name="close" /></button>',
      'иконка/пусто',
    ],
    ['кнопка с svg', '<button onClick={f}><svg /></button>', 'иконка/пусто'],
    [
      'глиф за aria-hidden',
      '<button onClick={f}><span aria-hidden="true">Закрыть</span></button>',
      'иконка/пусто',
    ],
    ['HTML-сущность', '<button onClick={f}>&times;</button>', '«·»'],
    ['глиф строковым выражением', "<button onClick={f}>{'+'}</button>", '«+»'],
    [
      'роль из выражения',
      "<div role={f ? 'switch' : undefined} tabIndex={0} />",
      'иконка/пусто',
    ],
    ['ссылка-иконка', '<a href="/x"><Icon /></a>', 'иконка/пусто'],
  ])('%s', (_name, jsx, shown) => {
    const res = gate({ 'webapp/src/X.tsx': tsx(jsx) });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/X.tsx:2');
    expect(res.stderr).toContain(shown);
  });

  it('shared/src тоже в области: общий код обоих фронтов', () => {
    const res = gate({
      'shared/src/Y.tsx': tsx('<button onClick={f}>−</button>'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shared/src/Y.tsx:2');
  });

  // Решение, закреплённое тестом: title — подсказка мыши, на тач-устройствах
  // его не озвучивают и не показывают, поэтому именем не считается.
  it('title вместо aria-label — всё равно красный', () => {
    const res = gate({
      'webapp/src/X.tsx': tsx('<button onClick={f} title="Назад">←</button>'),
    });
    expect(res.status).toBe(1);
  });

  it('сообщение подсказывает нейтральную метку', () => {
    const res = gate({
      'webapp/src/X.tsx': tsx('<button onClick={f}>←</button>'),
    });
    expect(res.stderr).toContain('aria-label');
    expect(res.stderr).toContain('«Назад»');
  });
});

describe('check-glyph-controls.mjs — зеленеет', () => {
  it.each([
    ['глиф с aria-label', '<button onClick={f} aria-label="Назад">←</button>'],
    [
      'pressable с aria-labelledby',
      '<div {...pressable(f)} aria-labelledby="t">×</div>',
    ],
    ['глиф рядом со словом', '<button onClick={f}>← Назад</button>'],
    ['цифра — тоже имя', '<button onClick={f}>2</button>'],
    ['имя из выражения', '<button onClick={f}>{f.name}</button>'],
    ['чужой компонент внутри', '<button onClick={f}><Badge /></button>'],
    ['чужой спред может нести aria-label', '<button {...props}>×</button>'],
    [
      'img с alt',
      '<button onClick={f}><img alt="Закрыть" src="x.svg" /></button>',
    ],
    [
      'текст во вложенном span',
      '<button onClick={f}><span>Сохранить</span></button>',
    ],
    ['не контрол', '<span className="arrow">›</span>'],
  ])('%s', (_name, jsx) => {
    const res = gate({ 'webapp/src/X.tsx': tsx(jsx) });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('тестовые файлы не сканируются: глиф там — фикстура', () => {
    const res = gate({
      'webapp/src/X.test.tsx': tsx('<button onClick={f}>←</button>'),
    });
    expect(res.status).toBe(0);
  });

  // Сознательная граница области: мини-апп удаляется по ONE_FRONTEND_PLAN.md,
  // его глиф-кнопки записаны в docs/README.md «Что осталось открытым».
  it('schema-miniapp вне области', () => {
    const res = gate({
      'schema-miniapp/src/X.tsx': tsx('<button onClick={f}>←</button>'),
    });
    expect(res.status).toBe(0);
  });
});
