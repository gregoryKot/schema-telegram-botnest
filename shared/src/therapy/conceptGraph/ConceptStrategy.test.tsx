// @vitest-environment jsdom
// Плашка «Обычно в методе» (#995): у режима со своим разделом — цель, техники
// «На сессии», «Между сессиями» с «Дать заданием» и «Подробнее»; без раздела —
// строка группы, как раньше. Раздел — фикстура (conceptGuide.fixture.ts).
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConceptStrategy } from './ConceptStrategy';
import { emptyModeLink } from './modeLinks';
import type { GraphModeCard } from './conceptGraphTypes';
import type { ConceptGuideActions } from './conceptGuide';
import { FIXTURE_GUIDE, FIXTURE_VIEW } from './conceptGuide.fixture';

const card: GraphModeCard = {
  modeId: 'vulnerable_child',
  name: 'Уязвимый Ребёнок',
  alias: '',
  color: 'var(--c-rose)',
  lane: 'child',
  schemas: [],
  needs: [],
  manifest: '',
  strategyHint: 'Строка группы детских режимов',
  empty: true,
};

function setup(opts: {
  guide?: typeof FIXTURE_VIEW | null;
  actions?: ConceptGuideActions;
  strategy?: string;
}) {
  const onChange = vi.fn();
  render(
    <ConceptStrategy
      card={card}
      link={{ ...emptyModeLink(card.modeId), strategy: opts.strategy ?? '' }}
      guide={opts.guide === undefined ? FIXTURE_VIEW : opts.guide}
      actions={opts.actions}
      onChange={onChange}
    />,
  );
  return { onChange };
}

const actions = () => ({
  onOpenMode: vi.fn(),
  onOpenSchema: vi.fn(),
  onOpenTechnique: vi.fn(),
  onAssign: vi.fn(),
});
const FROM = { kind: 'mode', id: 'vulnerable_child' } as const;

describe('ConceptStrategy: плашка «Обычно в методе»', () => {
  it('со своим разделом — цель режима, техники и пункты между сессиями вместо строки группы', () => {
    setup({ actions: actions() });
    expect(screen.getByText('Обычно в методе')).toBeTruthy();
    expect(screen.getByText(FIXTURE_GUIDE.goal)).toBeTruthy();
    expect(screen.queryByText(card.strategyHint)).toBeNull();
    expect(screen.getByText('На сессии')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Рескриптинг образов' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Работа со стульями' }),
    ).toBeTruthy();
    expect(screen.getByText('Между сессиями')).toBeTruthy();
    expect(screen.getByText('Письмо себе')).toBeTruthy();
    expect(screen.getByText(/от Здорового Взрослого/)).toBeTruthy();
    expect(screen.getByText('Встреча со своим маленьким Я')).toBeTruthy();
  });

  it('без раздела (свой режим терапевта) — строка группы, кнопок подсказок нет', () => {
    const { onChange } = setup({ guide: null, actions: actions() });
    expect(screen.getByText(card.strategyHint)).toBeTruthy();
    expect(screen.queryByText('На сессии')).toBeNull();
    expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Подробнее о режиме' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Взять за основу' }));
    expect(onChange).toHaveBeenCalledWith(card.strategyHint);
  });

  it('тексты подсказок ещё грузятся (guide undefined) — плашки нет, поле на месте', () => {
    render(
      <ConceptStrategy
        card={card}
        link={emptyModeLink(card.modeId)}
        guide={undefined}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('Обычно в методе')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Взять за основу' }),
    ).toBeNull();
    expect(screen.getByLabelText('Что делаем в терапии')).toBeTruthy();
  });

  it('«Взять за основу» кладёт цель режима; при заполненном поле кнопки нет', () => {
    const { onChange } = setup({ actions: actions() });
    fireEvent.click(screen.getByRole('button', { name: 'Взять за основу' }));
    expect(onChange).toHaveBeenCalledWith(FIXTURE_GUIDE.goal);
  });

  it('поле уже заполнено — «Взять за основу» не показывается, остальное на месте', () => {
    setup({ actions: actions(), strategy: 'Своя задача' });
    expect(
      screen.queryByRole('button', { name: 'Взять за основу' }),
    ).toBeNull();
    expect(screen.getByText(FIXTURE_GUIDE.goal)).toBeTruthy();
  });

  it('«Дать заданием» зовёт колбэк с пунктом и режимом; техника и «Подробнее» — свои листы', () => {
    const a = actions();
    setup({ actions: a });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Дать заданием: Встреча со своим маленьким Я',
      }),
    );
    expect(a.onAssign).toHaveBeenCalledWith(
      FIXTURE_GUIDE.betweenSessions[1],
      FROM,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Дать заданием: Письмо себе' }),
    );
    expect(a.onAssign).toHaveBeenLastCalledWith(
      FIXTURE_GUIDE.betweenSessions[0],
      FROM,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Работа со стульями' }));
    expect(a.onOpenTechnique).toHaveBeenCalledWith('chairwork', FROM);
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о режиме' }));
    expect(a.onOpenMode).toHaveBeenCalledWith('vulnerable_child');
    expect(a.onOpenSchema).not.toHaveBeenCalled();
  });

  it('без колбэков наружу — только текст: ни ссылок техник, ни «Дать заданием», ни «Подробнее»', () => {
    setup({});
    expect(screen.getByText('Рескриптинг образов').tagName).toBe('SPAN');
    expect(screen.getByText('Письмо себе')).toBeTruthy();
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['Взять за основу']);
  });

  it('есть листы, но нет задания (справочник без клиента) — без «Дать заданием»', () => {
    const { onAssign: _omit, ...noAssign } = actions();
    setup({ actions: noAssign });
    expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Подробнее о режиме' }),
    ).toBeTruthy();
  });
});
