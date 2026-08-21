// Регрессия К1 (аудит 2026-08): отклик режима 'angry_child' был сырой
// строкой без tr() — пользователь с формой «вы» видел «ты»-текст
// («Давай выясним»). Проверяем ВЕСЬ buildModes(), а не одну строку —
// чтобы такой же баг в новом режиме тоже краснел.
import { describe, it, expect } from 'vitest';
import { buildModes } from './constants';

// JS \b видит только ASCII-«word»-символы — на кириллице граница слова не
// срабатывает (\bты\b не матчит даже начало строки). Заменяем \b на явную
// проверку «не кириллическая буква рядом».
const NOT_CYR = '(?![а-яёА-ЯЁ])';
const NOT_CYR_BEFORE = '(?<![а-яёА-ЯЁ])';
const TY_MARKERS = new RegExp(
  `${NOT_CYR_BEFORE}[Тт]ы${NOT_CYR}|[Тт]еб[еяё]|[Тт]во[йяеё]|${NOT_CYR_BEFORE}Давай${NOT_CYR}`,
);

describe('buildModes: отклик режима звучит в форме «вы»', () => {
  const tr = (_ty: string, vy: string) => vy;
  const modes = buildModes(tr);

  it.each(modes.map((m) => [m.id, m.response] as const))(
    'режим %s не содержит «ты»-маркеров в форме «вы»',
    (_id, response) => {
      expect(response).not.toMatch(TY_MARKERS);
    },
  );

  it('в форме «ты» отклик остаётся на «ты» (контрольная проверка)', () => {
    const tyTr = (ty: string, _vy: string) => ty;
    const tyModes = buildModes(tyTr);
    const angry = tyModes.find((m) => m.id === 'angry_child');
    expect(angry?.response).toMatch(TY_MARKERS);
  });
});
