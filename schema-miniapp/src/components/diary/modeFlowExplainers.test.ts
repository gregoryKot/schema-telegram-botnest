// Правило обращения (CLAUDE.md): каждая новая user-facing строка обязана
// звучать в обеих формах, и «вы»-вариант не должен нигде показать «ты».
// Регэксп — тот же, что предписан для греп-свипа перед коммитом.
// Перебор всех четырёх билдеров (режимы + схемы, интро + дневник) — парные
// механики устроены одинаково (правило №3), тест общий на оба.
import { describe, it, expect } from 'vitest';
import {
  buildModeIntroExplainer,
  buildModeDiaryExplainer,
} from '../../../../shared/src/mode/modeFlowExplainers';
import {
  buildSchemaIntroExplainer,
  buildSchemaDiaryExplainer,
} from '../../../../shared/src/schema/schemaFlowExplainers';

const TY_LEAK = /[Тт]ы\b|[Тт]еб[еяё]|[Тт]во[йяеё]/;

const tyTr = (ty: string, _vy: string) => ty;
const vyTr = (_ty: string, vy: string) => vy;

const BUILDERS: Record<
  string,
  (tr: (ty: string, vy: string) => string) => string
> = {
  'Знакомство с режимом (buildModeIntroExplainer)': buildModeIntroExplainer,
  'Дневник режимов (buildModeDiaryExplainer)': buildModeDiaryExplainer,
  'Знакомство со схемой (buildSchemaIntroExplainer)': buildSchemaIntroExplainer,
  'Дневник схем (buildSchemaDiaryExplainer)': buildSchemaDiaryExplainer,
};

describe.each(Object.entries(BUILDERS))('%s', (_name, build) => {
  it('обе формы возвращают непустые строки', () => {
    expect(build(tyTr).length).toBeGreaterThan(0);
    expect(build(vyTr).length).toBeGreaterThan(0);
  });

  it('в «вы»-варианте нет остаточных «ты»-форм', () => {
    expect(build(vyTr)).not.toMatch(TY_LEAK);
  });

  it('«ты» и «вы» варианты различаются (есть обращение)', () => {
    expect(build(tyTr)).not.toBe(build(vyTr));
  });
});
