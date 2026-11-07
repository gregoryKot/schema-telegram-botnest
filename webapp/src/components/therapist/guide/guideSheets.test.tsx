// @vitest-environment jsdom
// Листы подсказок терапевту (#995): лист режима рисует разделы справочника и
// не рисует пустые (у режима бывают не все четыре канала), техники ведут в
// лист техники, «Дать заданием» отдаёт пункт; лист техники — шаги нумерованным
// списком. Пилот живого языка (2026-11): герой с заголовком и сутью, «Как это
// звучит», а «Где застревают», «Когда не делать», доказательность и пункты
// `more` — под «Подробнее», закрытым по умолчанию. Содержание — фикстура, не
// тексты shared/src/schemaTherapy/guide/.
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
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));

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
  it('герой — название и суть; разделы по порядку; пустой канал («В жизни») не показывается', () => {
    renderMode(vi.fn());
    const dialog = screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' });
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Уязвимый Ребёнок' })).toBeTruthy();
    expect(within(dialog).getByText('Режим')).toBeTruthy();
    expect(screen.getByText(FIXTURE_GUIDE.what)).toBeTruthy();
    expect(regions()).toEqual(['Цель', 'Как работать', 'На сессии', 'Между сессиями', 'Источники']);
    expect(within(screen.getByRole('region', { name: 'Цель' })).getByText(FIXTURE_GUIDE.goal)).toBeTruthy();
    const leads = within(screen.getByRole('region', { name: 'Как работать' })).getAllByRole('listitem')
      .map((li) => li.querySelector('.gd-lead')?.textContent);
    expect(leads).toEqual(['В отношениях', 'Через понимание', 'Через чувства и образы']);
    expect(screen.getByText(FIXTURE_GUIDE.sources)).toBeTruthy();
  });

  it('«Где застревают» — под «Подробнее»: закрыто, по тапу открывается', () => {
    renderMode();
    expect(screen.queryByText(FIXTURE_GUIDE.stuck!)).toBeNull();
    openMore();
    expect(within(screen.getByRole('region', { name: 'Где застревают' })).getByText(FIXTURE_GUIDE.stuck!)).toBeTruthy();
  });

  it('у режима без «Где застревают» и без каналов этих разделов и «Подробнее» нет вовсе', () => {
    const bare = { ...FIXTURE_GUIDE, relationship: undefined, cognitive: '  ', experiential: undefined, stuck: undefined };
    render(
      <MemoryRouter>
        <ModeGuideSheet modeName="Уязвимый Ребёнок" view={{ ...FIXTURE_VIEW, guide: bare }} onOpenTechnique={() => {}} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(regions()).toEqual(['Цель', 'На сессии', 'Между сессиями', 'Источники']);
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });

  it('переписанный раздел: «Как это звучит» репликами в кавычках, пункты `more` — под «Подробнее»', () => {
    const guide = { ...FIXTURE_GUIDE, voice: ['Я рядом', ' '], more: ['Оттенки режима'] };
    render(
      <MemoryRouter>
        <ModeGuideSheet modeName="Уязвимый Ребёнок" view={{ ...FIXTURE_VIEW, guide }} onOpenTechnique={() => {}} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(regions()[0]).toBe('Как это звучит');
    const lines = within(screen.getByRole('region', { name: 'Как это звучит' })).getAllByText(/^«/);
    expect(lines.map((l) => [l.tagName, l.textContent])).toEqual([['BLOCKQUOTE', '«Я рядом»']]);
    expect(screen.queryByText('Оттенки режима')).toBeNull();
    openMore();
    expect(screen.getByText('Оттенки режима')).toBeTruthy();
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
  it('герой — название и суть; «Когда», шаги нумерованным списком; «Когда не делать» и доказательность — под «Подробнее»', () => {
    render(<MemoryRouter><TechniqueSheet technique={FIXTURE_TECHNIQUES[0]} onClose={() => {}} /></MemoryRouter>);
    const dialog = screen.getByRole('dialog', { name: 'Рескриптинг образов' });
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Рескриптинг образов' })).toBeTruthy();
    expect(within(dialog).getByText('Техника')).toBeTruthy();
    expect(screen.getByText(FIXTURE_TECHNIQUES[0].summary)).toBeTruthy();
    expect(regions()).toEqual(['Когда', 'Как проводить', 'Источники']);
    const steps = within(screen.getByRole('region', { name: 'Как проводить' })).getByRole('list');
    expect(steps.tagName).toBe('OL');
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(FIXTURE_TECHNIQUES[0].steps);
    expect(screen.queryByText(FIXTURE_TECHNIQUES[0].cautions!)).toBeNull();
    openMore();
    expect(regions()).toEqual(['Когда', 'Как проводить', 'Когда не делать', 'Доказательность', 'Источники']);
  });

  it('у техники без «Когда», предостережений и доказательности этих разделов и «Подробнее» нет', () => {
    render(<MemoryRouter><TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} onClose={() => {}} /></MemoryRouter>);
    expect(regions()).toEqual(['Как проводить', 'Источники']);
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });

  it('переписанная техника: «Как это звучит» до шагов, пункты `more` первыми под «Подробнее»', () => {
    const t = { ...FIXTURE_TECHNIQUES[0], voice: ['Что самое маленькое?'], more: ['Срыв — повод разобраться'] };
    render(<MemoryRouter><TechniqueSheet technique={t} onClose={() => {}} /></MemoryRouter>);
    expect(regions()).toEqual(['Как это звучит', 'Когда', 'Как проводить', 'Источники']);
    expect(screen.getByText('«Что самое маленькое?»')).toBeTruthy();
    openMore();
    expect(screen.getByText('Срыв — повод разобраться')).toBeTruthy();
  });
});

// История и «Делали сегодня» (#995): строки серым приходят готовыми (guideNotes),
// кнопка отметки — только у листа техники, открытого из схемы случая клиента.
describe('история в листах', () => {
  it('лист режима: «делали …» под техникой, «давали …» под заданием', () => {
    const notes = {
      technique: (id: string) => (id === 'chairwork' ? 'делали 2 раза, последний 5 ноя' : null),
      task: (item: { title: string }) => (item.title === 'Письмо себе' ? 'давали 12 окт · выполнено' : null),
    };
    render(
      <MemoryRouter>
        <ModeGuideSheet modeName="Уязвимый Ребёнок" view={FIXTURE_VIEW} notes={notes} onOpenTechnique={() => {}} onClose={() => {}} />
      </MemoryRouter>,
    );
    const session = within(screen.getByRole('region', { name: 'На сессии' }));
    expect(session.getByText('делали 2 раза, последний 5 ноя')).toBeTruthy();
    expect(session.queryAllByText(/делали/)).toHaveLength(1);
    const between = within(screen.getByRole('region', { name: 'Между сессиями' }));
    expect(between.getByText('давали 12 окт · выполнено')).toBeTruthy();
    expect(between.queryAllByText(/давали/)).toHaveLength(1);
  });

  it('лист техники без отметки (справочник) — кнопки нет', () => {
    render(<MemoryRouter><TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} onClose={() => {}} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Делали сегодня' })).toBeNull();
  });

  it('лист техники: «Делали сегодня» зовёт отметку; отмечено сегодня — «Отменить сегодняшнюю отметку»', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} mark={{ note: null, today: false, onToggle }} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Пока не отмечали')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Делали сегодня' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} mark={{ note: 'делали 7 ноя', today: true, onToggle }} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('делали 7 ноя')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить сегодняшнюю отметку' }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
