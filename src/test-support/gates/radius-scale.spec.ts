// Тест гейта check-radius-scale.mjs (#1619, решение 3): оба исхода — регресс
// краснеет, шкала и исключения зеленеют.
import { runGate } from './gate-sandbox';
import { loadNamedPatterns, loadStringList } from './pattern-loader';

const GATE = 'check-radius-scale.mjs';

describe('check-radius-scale.mjs', () => {
  it('карточка 24px в .css — exit 1 с файлом и строкой', () => {
    const res = runGate(GATE, {
      'webapp/src/styles/card.css':
        '.x-card {\n  padding: 8px;\n  border-radius: 24px;\n}\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/styles/card.css:3');
    expect(res.stderr).toContain('.x-card');
  });

  it('капсула 999px даже у чипа — exit 1: литерал вместо var(--r-pill)', () => {
    const res = runGate(GATE, {
      'webapp/src/a.css': '.x-chip { border-radius: 999px; }\n',
    });
    expect(res.status).toBe(1);
  });

  it('var(--r-pill) у кнопки — exit 1; у чипа и чипа из CHIP_ALLOW — нет', () => {
    const bad = runGate(GATE, {
      'webapp/src/a.css': '.x-btn { border-radius: var(--r-pill); }\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('только у чипов');
    const ok = runGate(GATE, {
      'webapp/src/a.css':
        '.x-chip, .pp-tag { border-radius: var(--r-pill); }\n.cd-tracker { border-radius: var(--r-pill); }\n',
    });
    expect(ok.status).toBe(0);
  });

  it('var(--r-20) у карточки — exit 1; верхние углы листа — нет', () => {
    const bad = runGate(GATE, {
      'webapp/src/a.css': '.x-card { border-radius: var(--r-20); }\n',
    });
    expect(bad.status).toBe(1);
    const ok = runGate(GATE, {
      'webapp/src/a.css':
        '.x-sheet { border-radius: var(--r-20) var(--r-20) 0 0; }\n',
    });
    expect(ok.status).toBe(0);
  });

  it('инлайн borderRadius: 24 и скелетон radius={22} — exit 1', () => {
    const res = runGate(GATE, {
      'webapp/src/A.tsx':
        'const s = { borderRadius: 24 };\nconst k = <Skeleton radius={22} />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/A.tsx:1');
    expect(res.stderr).toContain('webapp/src/A.tsx:2');
  });

  it('шкала ≤16, круг 50% и закомментированный литерал — exit 0', () => {
    const res = runGate(GATE, {
      'webapp/src/a.css':
        '/* было: border-radius: 24px */\n.x { border-radius: var(--r-16); }\n.d { border-radius: 50%; }\n.e { border-radius: 14px 14px 0 0; }\n',
      'shared/src/B.tsx':
        "const s = { borderRadius: 'var(--r-12)', width: 4 };\nconst k = <Skeleton radius={16} />;\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('радиусы по шкале');
  });

  it('визитка и админка — вне шкалы с причиной, не красные', () => {
    const res = runGate(GATE, {
      'webapp/src/pages/landing/Hero.tsx': 'const s = { borderRadius: 24 };\n',
      'webapp/src/pages/admin/List.tsx': 'const s = { borderRadius: 100 };\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('до PR визитки');
    expect(res.stdout).toContain('админка');
  });
  it('EXEMPT гасит визитку и админку, но не соседний экран', () => {
    const ex = loadNamedPatterns('check-radius-scale-rules.mjs', 'EXEMPT').map(
      (p) => new RegExp(p.source, p.flags),
    );
    const hit = (f: string) => ex.some((re) => re.test(f));
    expect(hit('webapp/src/pages/landing/HeroSection.tsx')).toBe(true);
    expect(hit('webapp/src/styles/product-landing-hero.css')).toBe(true);
    expect(hit('webapp/src/pages/admin/BookingsManager.tsx')).toBe(true);
    expect(hit('webapp/src/pages/ReviewsPage.tsx')).toBe(false);
    expect(hit('webapp/src/styles/paper.css')).toBe(false);
  });

  it('EXEMPT_SELECTORS гасит только .ds-seg, не .ds-seg-btn', () => {
    expect(
      loadStringList('check-radius-scale-rules.mjs', 'EXEMPT_SELECTORS'),
    ).toEqual(['.ds-seg']);
    expect(
      runGate(GATE, {
        'webapp/src/a.css': '.ds-seg { border-radius: 20px; }\n',
      }).status,
    ).toBe(0);
    expect(
      runGate(GATE, {
        'webapp/src/a.css': '.ds-seg-btn { border-radius: 20px; }\n',
      }).status,
    ).toBe(1);
  });

  it('CHIP_ALLOW и INLINE_PILL_ALLOW пускают капсулу только у своих', () => {
    expect(
      loadStringList('check-radius-scale-rules.mjs', 'CHIP_ALLOW'),
    ).toContain('.cd-tracker');
    expect(
      runGate(GATE, {
        'webapp/src/a.css': '.cd-tracker { border-radius: var(--r-pill); }\n',
      }).status,
    ).toBe(0);
    expect(
      runGate(GATE, {
        'webapp/src/a.css': '.cd-week { border-radius: var(--r-pill); }\n',
      }).status,
    ).toBe(1);
    const files = loadStringList(
      'check-radius-scale-rules.mjs',
      'INLINE_PILL_ALLOW',
    );
    expect(files).toContain('webapp/src/components/modeMap/ShapePicker.tsx');
    const line = "const s = { borderRadius: 'var(--r-pill)' };\n";
    expect(
      runGate(GATE, { 'webapp/src/components/modeMap/ShapePicker.tsx': line })
        .status,
    ).toBe(0);
    expect(
      runGate(GATE, { 'webapp/src/components/Other.tsx': line }).status,
    ).toBe(1);
  });
});
