// @vitest-environment jsdom
// Листы подсказок терапевту (#995): лист режима рисует разделы справочника и
// не рисует пустые (у режима бывают не все четыре канала), техники ведут в
// лист техники, «Дать заданием» отдаёт пункт; лист техники — шаги нумерованным
// списком. Пилот живого языка (2026-11): герой с заголовком и сутью, «Как это
// звучит»; лист режима — вкладки («Кратко», «На сессии», «Задания», «Теория»,
// там «Где застревают» и пункты `more`), лист техники — «Подробнее». Содержание — фикстура, не
// тексты shared/src/schemaTherapy/guide/.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeGuideSheet } from './ModeGuideSheet';
import { TechniqueSheet } from './TechniqueSheet';
import { markButtonLabel } from './guideJournal';
import { JOURNAL_LINK_LABEL } from '../../../../../shared/src/therapy/conceptGraph/JournalLink';
import {
  FIXTURE_GUIDE,
  FIXTURE_TECHNIQUES,
  FIXTURE_VIEW,
} from '../../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const regions = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
// Разделы всех вкладок листа (неактивные скрыты hidden="until-found").
const allRegions = () => screen.getAllByRole('region', { hidden: true }).map((r) => r.getAttribute('aria-label'));
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
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
  it('герой — название и суть; разделы по вкладкам; пустой канал («В жизни») не показывается', () => {
    renderMode(vi.fn());
    const dialog = screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' });
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Уязвимый Ребёнок' })).toBeTruthy();
    expect(within(dialog).getByText('Режим')).toBeTruthy();
    expect(screen.getByText(FIXTURE_GUIDE.what)).toBeTruthy();
    expect(allRegions()).toEqual(['Цель', 'На сессии', 'Как работать', 'Между сессиями', 'Где застревают', 'Источники']);
    expect(within(screen.getByRole('region', { name: 'Цель' })).getByText(FIXTURE_GUIDE.goal)).toBeTruthy();
    tab('На сессии');
    const leads = within(screen.getByRole('region', { name: 'Как работать' })).getAllByRole('listitem')
      .map((li) => li.querySelector('.gd-card-title')?.textContent);
    expect(leads).toEqual(['Терапевтические отношения (в отношениях)', 'Когнитивные (через понимание)', 'Эмпирические (через чувства и образы)']);
    tab('Теория');
    expect(within(screen.getByRole('region', { name: 'Источники' })).getByText(FIXTURE_GUIDE.sources)).toBeTruthy();
  });

  it('«Где застревают» — на вкладке «Теория»: по тапу вкладки открывается', () => {
    renderMode();
    expect(screen.queryByRole('region', { name: 'Где застревают' })).toBeNull();
    tab('Теория');
    expect(within(screen.getByRole('region', { name: 'Где застревают' })).getByText(FIXTURE_GUIDE.stuck!)).toBeTruthy();
  });

  it('у режима без «Где застревают» и без каналов этих разделов нет, на «Теории» остаются источники', () => {
    const bare = { ...FIXTURE_GUIDE, relationship: undefined, cognitive: '  ', experiential: undefined, stuck: undefined };
    render(
      <MemoryRouter>
        <ModeGuideSheet modeName="Уязвимый Ребёнок" view={{ ...FIXTURE_VIEW, guide: bare }} onOpenTechnique={() => {}} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(allRegions()).toEqual(['Цель', 'На сессии', 'Между сессиями', 'Источники']);
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });

  it('переписанный раздел: «Как это звучит» репликами в кавычках, пункты `more` — «Подробнее» на «Теории»', () => {
    const guide = { ...FIXTURE_GUIDE, voice: ['Я рядом', ' '], more: ['Оттенки режима'] };
    render(
      <MemoryRouter>
        <ModeGuideSheet modeName="Уязвимый Ребёнок" view={{ ...FIXTURE_VIEW, guide }} onOpenTechnique={() => {}} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(regions()[0]).toBe('Как это звучит');
    const lines = within(screen.getByRole('region', { name: 'Как это звучит' })).getAllByText(/^«/);
    expect(lines.map((l) => [l.tagName, l.textContent])).toEqual([['BLOCKQUOTE', '«Я рядом»']]);
    expect(screen.queryByRole('region', { name: 'Подробнее' })).toBeNull();
    tab('Теория');
    expect(within(screen.getByRole('region', { name: 'Подробнее' })).getByText('Оттенки режима')).toBeTruthy();
  });

  it('техника — кнопка с описанием; тап зовёт лист техники', () => {
    const { onOpenTechnique } = renderMode(vi.fn());
    tab('На сессии');
    const session = within(screen.getByRole('region', { name: 'На сессии' }));
    expect(session.getByText(FIXTURE_TECHNIQUES[1].summary)).toBeTruthy();
    fireEvent.click(session.getByRole('button', { name: 'Работа со стульями' }));
    expect(onOpenTechnique).toHaveBeenCalledWith('chairwork');
  });

  it('«Между сессиями»: название, серым пояснение или инструкция, «Дать заданием» отдаёт пункт', () => {
    const onAssign = vi.fn();
    renderMode(onAssign);
    tab('Задания');
    const between = within(screen.getByRole('region', { name: 'Между сессиями' }));
    expect(between.getByText('от Здорового Взрослого')).toBeTruthy();
    expect(between.getByText('Пять минут в день побыть рядом с детским образом')).toBeTruthy();
    fireEvent.click(between.getByRole('button', { name: 'Дать заданием: Встреча со своим маленьким Я' }));
    expect(onAssign).toHaveBeenCalledWith(FIXTURE_GUIDE.betweenSessions[1]);
  });

  it('без onAssign (справочник без клиента) кнопок задания нет', () => {
    renderMode();
    tab('Задания');
    expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
    expect(screen.getByText('Письмо себе')).toBeTruthy();
  });
});

describe('TechniqueSheet', () => {
  it('герой — название и суть; «Когда не делать» плашкой сразу под ним; шаги нумерованным списком; доказательность — под «Подробнее»', () => {
    render(<MemoryRouter><TechniqueSheet technique={FIXTURE_TECHNIQUES[0]} onClose={() => {}} /></MemoryRouter>);
    const dialog = screen.getByRole('dialog', { name: 'Рескриптинг образов' });
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Рескриптинг образов' })).toBeTruthy();
    expect(within(dialog).getByText('Техника')).toBeTruthy();
    expect(screen.getByText(FIXTURE_TECHNIQUES[0].summary)).toBeTruthy();
    expect(regions()).toEqual(['Когда не делать', 'Когда', 'Как проводить']);
    expect(screen.getByRole('region', { name: 'Когда не делать' }).parentElement?.className).toBe('gd-caution');
    const steps = within(screen.getByRole('region', { name: 'Как проводить' })).getByRole('list');
    expect(steps.tagName).toBe('OL');
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(FIXTURE_TECHNIQUES[0].steps);
    expect(screen.getByText(FIXTURE_TECHNIQUES[0].cautions!)).toBeTruthy();
    openMore();
    expect(regions()).toEqual(['Когда не делать', 'Когда', 'Как проводить', 'Доказательность']);
  });

  it('у техники без «Когда», предостережений и доказательности этих разделов и «Подробнее» нет', () => {
    render(<MemoryRouter><TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} onClose={() => {}} /></MemoryRouter>);
    expect(regions()).toEqual(['Как проводить']);
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });

  it('техника из другого подхода: подпись подхода вместо «Техника» и раздел «В схема-терапии» после «Когда»', () => {
    const t = { ...FIXTURE_TECHNIQUES[0], approach: 'ACT', pairsWith: 'Сочетается с работой с Критиками.' };
    render(<MemoryRouter><TechniqueSheet technique={t} onClose={() => {}} /></MemoryRouter>);
    const dialog = screen.getByRole('dialog', { name: 'Рескриптинг образов' });
    expect(within(dialog).getByText('Из другого подхода · ACT')).toBeTruthy();
    expect(within(dialog).queryByText('Техника')).toBeNull();
    expect(regions()).toEqual(['Когда не делать', 'Когда', 'В схема-терапии', 'Как проводить']);
    expect(within(screen.getByRole('region', { name: 'В схема-терапии' })).getByText(t.pairsWith)).toBeTruthy();
  });

  it('переписанная техника: «Как это звучит» до шагов, пункты `more` первыми под «Подробнее»', () => {
    const t = { ...FIXTURE_TECHNIQUES[0], voice: ['Что самое маленькое?'], more: ['Срыв — повод разобраться'] };
    render(<MemoryRouter><TechniqueSheet technique={t} onClose={() => {}} /></MemoryRouter>);
    expect(regions()).toEqual(['Когда не делать', 'Как это звучит', 'Когда', 'Как проводить']);
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
    tab('На сессии');
    const session = within(screen.getByRole('region', { name: 'На сессии' }));
    expect(session.getByText('делали 2 раза, последний 5 ноя')).toBeTruthy();
    expect(session.queryAllByText(/делали/)).toHaveLength(1);
    tab('Задания');
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
        <TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} mark={{ note: null, marked: false, onToggle }} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Пока не отмечали')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Делали сегодня' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} mark={{ note: 'делали 7 ноя', marked: true, onToggle }} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('делали 7 ноя')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить сегодняшнюю отметку' }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

// Журнал техник (#995): за «делали …» — «журнал →» в карточку клиента; лист,
// открытый строкой журнала, — кнопка про день этой строки.
describe('журнал техник в листах', () => {
  const notes = { technique: () => 'делали 2 раза, последний 5 ноя', task: () => null };

  it('лист режима: «журнал →» за «делали …» зовёт переход; без колбэка — строка без ссылки', () => {
    const onOpenJournal = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <ModeGuideSheet modeName="Уязвимый Ребёнок" view={FIXTURE_VIEW} notes={notes} onOpenJournal={onOpenJournal} onOpenTechnique={() => {}} onClose={() => {}} />
      </MemoryRouter>,
    );
    tab('На сессии');
    const session = within(screen.getByRole('region', { name: 'На сессии' }));
    fireEvent.click(session.getAllByRole('button', { name: JOURNAL_LINK_LABEL })[0]);
    expect(onOpenJournal).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <ModeGuideSheet modeName="Уязвимый Ребёнок" view={FIXTURE_VIEW} notes={notes} onOpenTechnique={() => {}} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: JOURNAL_LINK_LABEL })).toBeNull();
    expect(screen.getAllByText('делали 2 раза, последний 5 ноя').length).toBeGreaterThan(0);
  });

  it('лист техники: «журнал →» только когда есть «делали …»', () => {
    const onOpenJournal = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} mark={{ note: 'делали 5 ноя', marked: false, onToggle: () => {}, onOpenJournal }} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('делали 5 ноя')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: JOURNAL_LINK_LABEL }));
    expect(onOpenJournal).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <TechniqueSheet technique={FIXTURE_TECHNIQUES[1]} mark={{ note: null, marked: false, onToggle: () => {}, onOpenJournal }} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: JOURNAL_LINK_LABEL })).toBeNull();
  });

  it('день строки журнала: «Снять отметку за …», снятую — «Вернуть отметку за …»; без дня — про сегодня', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-07T12:00:00Z')); // день того же года — без года в подписи
    expect(markButtonLabel(true, '2026-11-05')).toBe('Снять отметку за 5 ноя');
    expect(markButtonLabel(false, '2026-11-05')).toBe('Вернуть отметку за 5 ноя');
    expect(markButtonLabel(true)).toBe('Отменить сегодняшнюю отметку');
    expect(markButtonLabel(false)).toBe('Делали сегодня');
    vi.useRealTimers();
  });
});
