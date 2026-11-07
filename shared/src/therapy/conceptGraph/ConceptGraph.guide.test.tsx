// @vitest-environment jsdom
// Подсказки терапевту (#995) через весь граф: тап по фигуре режима → редактор →
// плашка со своим разделом режима; колбэки `guide` доходят до кнопок, без
// пропа плашка — только текст. Раздел — фикстура, не тексты guide/.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConceptGraph } from './ConceptGraph';
import type { ConceptGuideActions } from './conceptGuide';
import { FIXTURE_GUIDE } from './conceptGuide.fixture';
import { modeFigure } from './ConceptGraph.test-helpers';

vi.mock('../../schemaTherapy/guide', async () => {
  const f = await import('./conceptGuide.fixture');
  return {
    modeGuide: (_tr: unknown, id: string) =>
      id === 'vulnerable_child' ? f.FIXTURE_GUIDE : null,
    buildTechniqueGuides: () => f.FIXTURE_TECHNIQUES,
  };
});

const source = {
  modeIds: ['vulnerable_child', 'punitive_critic'],
  schemaIds: [],
  modeLinks: [],
  schemaLinks: [],
};

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
    const guide = {
      onOpenMode: vi.fn(),
      onOpenTechnique: vi.fn(),
      onAssign: vi.fn(),
    };
    renderGraph(guide);
    fireEvent.click(modeFigure('Уязвимый Ребёнок'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Рескриптинг образов' }),
    );
    expect(guide.onOpenTechnique).toHaveBeenCalledWith(
      'imagery_rescripting',
      'vulnerable_child',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Дать заданием: Письмо себе' }),
    );
    expect(guide.onAssign).toHaveBeenCalledWith(
      FIXTURE_GUIDE.betweenSessions[0],
      'vulnerable_child',
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
