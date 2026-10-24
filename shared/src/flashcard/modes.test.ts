// @vitest-environment jsdom
// Регрессия К1 (аудит 2026-08): отклик режима 'angry_child' был сырой
// строкой без tr() в одной из копий (miniapp) — пользователь с формой «вы»
// видел «ты»-текст («Давай выясним»). buildModes/NEEDS/STEPS теперь живут
// только здесь (правило №3 CLAUDE.md) — тест покрывает ОБА фронтенда разом.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildModes, NEEDS, STEPS, STORAGE_KEY, loadLocal } from './modes';

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

describe('NEEDS/STEPS: контент непустой', () => {
  it('пять потребностей с непустыми label/emoji', () => {
    expect(NEEDS.length).toBe(5);
    for (const n of NEEDS) {
      expect(n.label.trim().length).toBeGreaterThan(0);
      expect(n.emoji.length).toBeGreaterThan(0);
    }
  });

  it('четыре шага в фиксированном порядке', () => {
    expect(STEPS).toEqual(['mode', 'response', 'need', 'action']);
  });
});

describe('loadLocal', () => {
  beforeEach(() => localStorage.clear());

  it('пусто в localStorage — пустой массив', () => {
    expect(loadLocal()).toEqual([]);
  });

  it('валидный JSON — возвращает сохранённые карточки', () => {
    const entry = {
      id: '1',
      date: '1 янв',
      mode: 'critic',
      reflection: '',
      needId: 'limits',
      action: '',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry]));
    expect(loadLocal()).toEqual([entry]);
  });

  it('битый JSON — не падает, пустой массив (деградация, а не краш)', () => {
    localStorage.setItem(STORAGE_KEY, '{не json');
    expect(loadLocal()).toEqual([]);
  });
});
