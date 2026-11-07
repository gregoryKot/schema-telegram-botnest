// @vitest-environment jsdom
// Подсказки терапевту (#995) через весь граф: тап по фигуре режима или схемы →
// редактор → плашка со своим разделом; колбэки `guide` доходят до кнопок и
// знают, чей раздел; без пропа плашка — только текст. Разделы — фикстура, не
// тексты guide/.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConceptGraph } from './ConceptGraph';
import type { ConceptGuideActions } from './conceptGuide';
import { FIXTURE_GUIDE, FIXTURE_SCHEMA_GUIDE } from './conceptGuide.fixture';
import { modeFigure, schemaFigure } from './ConceptGraph.test-helpers';

vi.mock('../../schemaTherapy/guide', async () => {
  const f = await import('./conceptGuide.fixture');
  return {
    modeGuide: (_tr: unknown, id: string) =>
      id === 'vulnerable_child' ? f.FIXTURE_GUIDE : null,
    schemaGuide: (_tr: unknown, id: string) =>
      id === 'abandonment'
        ? { guide: f.FIXTURE_SCHEMA_GUIDE, domainNote: f.FIXTURE_DOMAIN_NOTE }
        : null,
    buildTechniqueGuides: () => f.FIXTURE_TECHNIQUES,
  };
});

const ABANDONMENT = 'Покинутость / Нестабильность';
const source = {
  modeIds: ['vulnerable_child', 'punitive_critic'],
  schemaIds: ['abandonment', 'emotional_deprivation'],
  modeLinks: [],
  schemaLinks: [],
};

const actions = () => ({
  onOpenMode: vi.fn(),
  onOpenSchema: vi.fn(),
  onOpenTechnique: vi.fn(),
  onAssign: vi.fn(),
});

function renderGraph(guide?: ConceptGuideActions) {
  const onChangeLink = vi.fn();
  render(
    <ConceptGraph
      source={source}
      track={() => {}}
      onToggleMode={() => {}}
      onChangeLink={onChangeLink}
      onChangeSchemaLink={() => {}}
      onToggleSchema={() => {}}
      onAddSchema={() => {}}
      guide={guide}
    />,
  );
  return { onChangeLink };
}

describe('ConceptGraph: подсказки терапевту', () => {
  it('режим со своим разделом: цель вместо строки группы, «Взять за основу» кладёт цель', async () => {
    const { onChangeLink } = renderGraph();
    fireEvent.click(modeFigure('Уязвимый Ребёнок'));
    expect(await screen.findByText(FIXTURE_GUIDE.goal)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Взять за основу' }));
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modeId: 'vulnerable_child',
        strategy: FIXTURE_GUIDE.goal,
      }),
    );
  });

  it('колбэки доходят до плашки: техника, «Дать заданием», «Подробнее»', async () => {
    const guide = actions();
    const from = { kind: 'mode', id: 'vulnerable_child' };
    renderGraph(guide);
    fireEvent.click(modeFigure('Уязвимый Ребёнок'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Рескриптинг образов' }),
    );
    expect(guide.onOpenTechnique).toHaveBeenCalledWith(
      'imagery_rescripting',
      from,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Дать заданием: Письмо себе' }),
    );
    expect(guide.onAssign).toHaveBeenCalledWith(
      FIXTURE_GUIDE.betweenSessions[0],
      from,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о режиме' }));
    expect(guide.onOpenMode).toHaveBeenCalledWith('vulnerable_child');
  });

  it('без пропа guide — плашка только текстом; режим без раздела — строка группы', async () => {
    renderGraph();
    fireEvent.click(modeFigure('Уязвимый Ребёнок'));
    await screen.findByText(FIXTURE_GUIDE.goal);
    expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Подробнее о режиме' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    fireEvent.click(modeFigure('Карающий Критик'));
    expect(await screen.findByText('Обычно в методе')).toBeTruthy();
    expect(screen.queryByText('На сессии')).toBeNull();
  });
});

describe('ConceptGraph: подсказки терапевту по схеме', () => {
  it('схема со своим разделом: цель, «На сессии», «Между сессиями», «Подробнее о схеме»; «Взять за основу» нет', async () => {
    renderGraph(actions());
    fireEvent.click(schemaFigure(ABANDONMENT));
    expect(await screen.findByText(FIXTURE_SCHEMA_GUIDE.goal)).toBeTruthy();
    expect(screen.getByText('Обычно в методе')).toBeTruthy();
    expect(screen.getByText('На сессии')).toBeTruthy();
    expect(screen.getByText('Между сессиями')).toBeTruthy();
    expect(screen.getByText('Карточка схемы')).toBeTruthy();
    expect(screen.getByText('Дневник разлук')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Подробнее о схеме' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Подробнее о режиме' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Взять за основу' }),
    ).toBeNull();
  });

  it('схема без раздела — плашки нет, поля редактора на месте', async () => {
    renderGraph(actions());
    fireEvent.click(schemaFigure(ABANDONMENT));
    await screen.findByText(FIXTURE_SCHEMA_GUIDE.goal);
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    fireEvent.click(schemaFigure('Эмоциональная депривация'));
    expect(screen.getByLabelText('Во что человек верит')).toBeTruthy();
    expect(screen.queryByText('Обычно в методе')).toBeNull();
    expect(screen.queryByText('На сессии')).toBeNull();
  });

  it('«Подробнее о схеме», техника и «Дать заданием» зовут колбэки со схемой', async () => {
    const guide = actions();
    const from = { kind: 'schema', id: 'abandonment' };
    renderGraph(guide);
    fireEvent.click(schemaFigure(ABANDONMENT));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Подробнее о схеме' }),
    );
    expect(guide.onOpenSchema).toHaveBeenCalledWith('abandonment');
    expect(guide.onOpenMode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Работа со стульями' }));
    expect(guide.onOpenTechnique).toHaveBeenCalledWith('chairwork', from);
    fireEvent.click(
      screen.getByRole('button', { name: 'Дать заданием: Дневник разлук' }),
    );
    expect(guide.onAssign).toHaveBeenCalledWith(
      FIXTURE_SCHEMA_GUIDE.betweenSessions[1],
      from,
    );
  });

  it('без пропа guide — плашка схемы только текстом', async () => {
    renderGraph();
    fireEvent.click(schemaFigure(ABANDONMENT));
    expect(await screen.findByText(FIXTURE_SCHEMA_GUIDE.goal)).toBeTruthy();
    expect(screen.getByText('Работа со стульями').tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Подробнее о схеме' }),
    ).toBeNull();
  });
});
