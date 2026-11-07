// @vitest-environment jsdom
// Плашка «Обычно в методе» (#995): история серым у пунктов — «делали …» у
// техники по отметкам связи и «давали …» у задания по заданиям клиента из
// `actions.tasks`. Без заданий (справочник без клиента) строк «давали» нет.
// За «делали …» — «журнал →» (actions.onOpenJournal), без колбэка — текст.
// Раздел — фикстура (conceptGuide.fixture.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConceptGuideHint } from './ConceptGuideHint';
import type { ConceptGuideActions } from './conceptGuide';
import { FIXTURE_SCHEMA_VIEW, FIXTURE_VIEW } from './conceptGuide.fixture';
import type { GuideTask } from './guideHistory';
import { JOURNAL_LINK_LABEL } from './JournalLink';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const MODE = { kind: 'mode', id: 'vulnerable_child' } as const;
const actions = (tasks?: GuideTask[]): ConceptGuideActions => ({
  onOpenMode: vi.fn(),
  onOpenSchema: vi.fn(),
  onOpenTechnique: vi.fn(),
  onAssign: vi.fn(),
  tasks,
});
const marks = [
  { techniqueId: 'chairwork', day: '2026-11-05' },
  { techniqueId: 'chairwork', day: '2026-10-29' },
  { techniqueId: 'imagery_rescripting', day: '2026-11-01' },
];
const tasks: GuideTask[] = [
  {
    type: 'letter_to_self',
    text: 'Написать письмо',
    done: true,
    dueDate: null,
    createdAt: '2026-10-12T10:00:00.000Z',
  },
  {
    type: 'custom',
    text: 'Встреча со своим маленьким Я\nПять минут',
    done: null,
    dueDate: null,
    createdAt: '2026-10-20T10:00:00.000Z',
  },
  {
    type: 'custom',
    text: 'Встреча со своим маленьким Я',
    done: false,
    dueDate: null,
    createdAt: '2026-10-01T10:00:00.000Z',
  },
];

describe('ConceptGuideHint — история', () => {
  it('техники: «делали …» рядом с названием; задания: «давали …» под пунктом', () => {
    render(
      <ConceptGuideHint
        view={FIXTURE_VIEW}
        from={MODE}
        actions={actions(tasks)}
        marks={marks}
      />,
    );
    expect(screen.getByText('· делали 2 раза, последний 5 ноя')).toBeTruthy();
    expect(screen.getByText('· делали 1 ноя')).toBeTruthy();
    expect(screen.getByText('давали 12 окт · выполнено')).toBeTruthy();
    expect(
      screen.getByText('давали 2 раза, последний 20 окт · в работе'),
    ).toBeTruthy();
  });

  it('ничего не давали и не делали — строк истории нет', () => {
    render(
      <ConceptGuideHint
        view={FIXTURE_VIEW}
        from={MODE}
        actions={actions([])}
      />,
    );
    expect(screen.queryByText(/делали|давали/)).toBeNull();
  });

  it('без заданий клиента (справочник) — без «давали», отметки по-прежнему видны', () => {
    render(<ConceptGuideHint view={FIXTURE_VIEW} from={MODE} marks={marks} />);
    expect(screen.queryByText(/давали/)).toBeNull();
    expect(screen.getByText('· делали 1 ноя')).toBeTruthy();
  });

  it('схема: карточка схемы считается по id схемы раздела', () => {
    const schemaTasks: GuideTask[] = [
      {
        type: 'schema_intro',
        text: 'abandonment',
        done: false,
        dueDate: null,
        createdAt: '2026-10-12T10:00:00.000Z',
      },
      {
        type: 'schema_intro',
        text: 'mistrust',
        done: true,
        dueDate: null,
        createdAt: '2026-10-13T10:00:00.000Z',
      },
    ];
    render(
      <ConceptGuideHint
        view={FIXTURE_SCHEMA_VIEW}
        from={{ kind: 'schema', id: 'abandonment' }}
        actions={actions(schemaTasks)}
      />,
    );
    expect(screen.getByText('давали 12 окт · не вышло')).toBeTruthy();
  });
});

describe('ConceptGuideHint — «журнал →»', () => {
  it('за каждой строкой «делали …» — ссылка; тап зовёт переход', () => {
    const onOpenJournal = vi.fn();
    render(
      <ConceptGuideHint
        view={FIXTURE_VIEW}
        from={MODE}
        actions={{ ...actions(), onOpenJournal }}
        marks={marks}
      />,
    );
    const links = screen.getAllByRole('button', { name: JOURNAL_LINK_LABEL });
    // «делали …» у двух техник из трёх — две ссылки
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe('журнал →');
    fireEvent.click(links[0]);
    expect(onOpenJournal).toHaveBeenCalledTimes(1);
  });

  it('без колбэка (справочник) и без отметок — ссылки нет', () => {
    const { unmount } = render(
      <ConceptGuideHint
        view={FIXTURE_VIEW}
        from={MODE}
        actions={actions()}
        marks={marks}
      />,
    );
    expect(
      screen.queryByRole('button', { name: JOURNAL_LINK_LABEL }),
    ).toBeNull();
    unmount();
    render(
      <ConceptGuideHint
        view={FIXTURE_VIEW}
        from={MODE}
        actions={{ ...actions(), onOpenJournal: vi.fn() }}
      />,
    );
    expect(
      screen.queryByRole('button', { name: JOURNAL_LINK_LABEL }),
    ).toBeNull();
  });
});
