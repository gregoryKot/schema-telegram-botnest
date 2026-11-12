// @vitest-environment jsdom
// Знаки «Моего пути» сайта (b22-journey): строка ленты — знак сущности шага на её бумаге (journeyLook →
// ENTITY_LOOK), режим — знак своей группы, потребность — свой знак; плитка счётчика — знак, число,
// подпись; деталь — шапка EntitySheet со знаком и голос Здорового Взрослого вставкой мха. Сквозная
// проверка: в ленте и детали сайта нет ни одного эмодзи (было 📊📝📔🎭🌱🌿✅ и 🏝 в шапке детали).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { JourneyRowSign, JourneySign, JourneyStat } from './JourneySigns';
import { JOURNEY_DETAIL_ART, WEB_JOURNEY_KIT } from './webJourneyKit';
import { JourneyTimeline } from '../../../../shared/src/journey/JourneyTimeline';
import { JourneyItemDetail } from '../../../../shared/src/journey/JourneyItemDetail';
import { JOURNEY_TYPE_META, groupJourneyByMonth } from '../../../../shared/src/journey/journeyMeta';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

afterEach(cleanup);

const AT = '2026-07-21T10:00:00Z';
const EMOJI = /\p{Extended_Pictographic}/u;
const ALL = Object.keys(JOURNEY_TYPE_META).map((type, i) => ({ type, at: AT, id: i }));

describe('знак строки ленты', () => {
  it('у каждого типа шага строка несёт знак и бумагу своей сущности', () => {
    const { container } = render(
      <JourneyTimeline groups={groupJourneyByMonth(ALL, new Date(AT))} subtitle={() => null} onOpenItem={vi.fn()} rowArt={WEB_JOURNEY_KIT.rowArt} />,
    );
    const signs = [...container.querySelectorAll<HTMLElement>('.jr-sign')];
    expect(signs).toHaveLength(ALL.length);
    for (const s of signs) {
      expect(s.dataset.sign).toBeTruthy();
      expect(s.querySelector('svg')).not.toBeNull();
      expect(s.style.getPropertyValue('--h')).not.toBe('');
    }
    expect(container.textContent).not.toMatch(EMOJI);
  });

  it('режим — знак группы на небе, потребность — свой знак', () => {
    const sign = (item: Parameters<typeof JourneyRowSign>[0]['item']) => {
      const { container } = render(<JourneyRowSign item={item} />);
      const s = container.querySelector('.jr-sign') as HTMLElement;
      const out = [s.dataset.sign, s.style.getPropertyValue('--h')];
      cleanup();
      return out;
    };
    expect(sign({ type: 'mode_diary', at: AT, modeId: 'punitive_critic' })).toEqual(['looming', '240']);
    expect(sign({ type: 'practice', at: AT, needId: 'play' })).toEqual(['need_play', '310']);
  });

  it('благодарность — Pebbles filled (два гнезда), «Заметка дня» — три камешка; на плитке счётчика так же', () => {
    const laidNo = (el: Element) => el.querySelectorAll('[data-laid="no"]').length;
    const g = render(<JourneyRowSign item={{ type: 'gratitude', at: AT }} />).container;
    expect(laidNo(g)).toBe(2);
    cleanup();
    const n = render(<JourneyRowSign item={{ type: 'note', at: AT }} />).container;
    expect(laidNo(n)).toBe(0);
    expect(n.querySelectorAll('ellipse')).toHaveLength(3);
    cleanup();
    const t = render(<JourneyStat row={{ type: 'gratitude', emoji: '', label: 'Благодарности', count: 2 }} />).container;
    expect(laidNo(t)).toBe(2);
  });

  it('незнакомый тип — пустая бумажка без знака', () => {
    const { container } = render(<JourneySign look={null} />);
    const s = container.querySelector('.jr-sign') as HTMLElement;
    expect(s.dataset.sign).toBeUndefined();
    expect(s.querySelector('svg')).toBeNull();
  });
});

describe('плитка счётчика', () => {
  it('знак занятия, число и подпись на бумаге занятия', () => {
    const { container } = render(<JourneyStat row={{ type: 'breathing', emoji: '🌬', label: 'Дыхательные практики', count: 6 }} />);
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('Дыхательные практики')).toBeTruthy();
    const tile = container.querySelector('.jr-stat') as HTMLElement;
    expect(tile.style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.breathing.hue));
    expect(tile.querySelector('svg')).not.toBeNull();
    expect(container.textContent).not.toMatch(EMOJI);
  });
});

describe('деталь шага', () => {
  const detail = (type: string, parts: { title?: string; text: string }[]) => ({
    item: { type, at: AT, modeId: type === 'mode_diary' ? 'punitive_critic' : undefined },
    parts, loading: false, open: vi.fn(), close: vi.fn(),
  });

  it('шапка — лист сущности со знаком, «Здоровый Взрослый» — вставка мха', () => {
    const { container } = render(
      <JourneyItemDetail
        detail={detail('mode_diary', [{ title: 'Ситуация', text: 'Опоздание' }, { title: 'Здоровый Взрослый', text: 'Пять минут' }])}
        subtitle={() => 'Карающий Критик'}
        onShare={vi.fn()}
        art={JOURNEY_DETAIL_ART}
      />,
    );
    const head = container.querySelector('.pa-sheet') as HTMLElement;
    expect(head.dataset.sign).toBe('looming');
    expect(head.style.getPropertyValue('--h')).toBe('240');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Дневник режимов');
    expect(container.querySelector('.pa-voice')?.textContent).toContain('Пять минут');
  });

  it('ни у одного типа шага в детали нет эмодзи', () => {
    for (const { type } of ALL) {
      const { container } = render(
        <JourneyItemDetail detail={detail(type, [{ title: 'Поле', text: 'текст' }])} subtitle={() => null} onShare={vi.fn()} art={JOURNEY_DETAIL_ART} />,
      );
      expect(container.textContent, type).not.toMatch(EMOJI);
      expect(container.querySelector('.pa-sheet [data-sign], .pa-sheet[data-sign]'), type).not.toBeNull();
      cleanup();
    }
  });
});
