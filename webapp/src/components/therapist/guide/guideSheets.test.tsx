// @vitest-environment jsdom
// Листы подсказок терапевту (#995): лист режима рисует разделы справочника и
// не рисует пустые (у режима бывают не все четыре канала), техники ведут в
// лист техники, «Дать заданием» отдаёт пункт; лист техники — шаги нумерованным
// списком. Содержание — фикстура, не тексты shared/src/schemaTherapy/guide/.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeGuideSheet } from './ModeGuideSheet';
import { TechniqueSheet } from './TechniqueSheet';
import {
  FIXTURE_GUIDE,
  FIXTURE_TECHNIQUES,
  FIXTURE_VIEW,
} from '../../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const regions = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));

function renderMode(onAssign?: (item: unknown) => void) {
  const onOpenTechnique = vi.fn();
  render(
    <MemoryRouter>
      <ModeGuideSheet
        modeName="Уязвимый Ребёнок" view={FIXTURE_VIEW}
        onOpenTechnique={onOpenTechnique} onAssign={onAssign} onClose={() => {}}
      />
    </MemoryRouter>,
  );
  return { onOpenTechnique };
}

describe('ModeGuideSheet', () => {
  it('разделы справочника по порядку; пустой канал («Поведенчески») не показывается', () => {
    renderMode(vi.fn());
    expect(screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' })).toBeTruthy();
    expect(regions()).toEqual([
      'Что это', 'Цель', 'Отношения', 'Когнитивно', 'Экспериенциально',
      'На сессии', 'Между сессиями', 'Где застревают', 'Источники',
    ]);
    expect(within(screen.getByRole('region', { name: 'Цель' })).getByText(FIXTURE_GUIDE.goal)).toBeTruthy();
    expect(screen.getByText(FIXTURE_GUIDE.sources)).toBeTruthy();
  });

  it('у режима без «Где застревают» и без каналов этих разделов нет вовсе', () => {
    const bare = { ...FIXTURE_GUIDE, relationship: undefined, cognitive: '  ', experiential: undefined, stuck: undefined };
    render(
      <MemoryRouter>
        <ModeGuideSheet modeName="Уязвимый Ребёнок" view={{ ...FIXTURE_VIEW, guide: bare }} onOpenTechnique={() => {}} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(regions()).toEqual(['Что это', 'Цель', 'На сессии', 'Между сессиями', 'Источники']);
  });

  it('техника — кнопка с описанием; тап зовёт лист техники', () => {
    const { onOpenTechnique } = renderMode(vi.fn());
    const session = within(screen.getByRole('region', { name: 'На сессии' }));
    expect(session.getByText(FIXTURE_TECHNIQUES[1].summary)).toBeTruthy();
    fireEvent.click(session.getByRole('button', { name: 'Работа со стульями' }));
    expect(onOpenTechnique).toHaveBeenCalledWith('chairwork');
  });

  it('«Между сессиями»: название, серым пояснение или инструкция, «Дать заданием» отдаёт пункт', () => {
    const onAssign = vi.fn();
    renderMode(onAssign);
    const between = within(screen.getByRole('region', { name: 'Между сессиями' }));
    expect(between.getByText('от Здорового Взрослого')).toBeTruthy();
    expect(between.getByText('Пять минут в день побыть рядом с детским образом')).toBeTruthy();
    fireEvent.click(between.getByRole('button', { name: 'Дать заданием: Встреча со своим маленьким Я' }));
    expect(onAssign).toHaveBeenCalledWith(FIXTURE_GUIDE.betweenSessions[1]);
  });

  it('без onAssign (справочник без клиента) кнопок задания нет', () => {
    renderMode();
    expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
    expect(screen.getByText('Письмо себе')).toBeTruthy();
  });
});

describe('TechniqueSheet', () => {
  it('описание, «Когда», шаги нумерованным списком, «Когда не делать», доказательность, источники', () => {
    render(<MemoryRouter><TechniqueSheet technique={FIXTURE_TECHNIQUES[0]} onClose={() => {}} /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: 'Рескриптинг образов' })).toBeTruthy();
    expect(screen.getByText(FIXTURE_TECHNIQUES[0].summary)).toBeTruthy();
    expect(regions()).toEqual(['Когда', 'Как проводить', 'Когда не делать', 'Доказательность', 'Источники']);
    const steps = within(screen.getByRole('region', { name: 'Как проводить' })).getByRole('list');
    expect(steps.tagName).toBe('OL');
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(FIXTURE_TECHNIQUES[0].steps);
  });

  it('у техники без «Когда», предостережений и доказательности этих разделов нет', () => {
    render(<MemoryRouter><TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} onClose={() => {}} /></MemoryRouter>);
    expect(regions()).toEqual(['Как проводить', 'Источники']);
  });
});
