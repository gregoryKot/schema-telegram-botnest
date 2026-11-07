// «Делали сегодня» (#995): отметка уходит правкой связи режима или схемы — тем же
// onChangeLink / onChangeSchemaLink, что у графа; связи схемы ещё нет — она
// создаётся; повторный тап в тот же день снимает отметку и события не шлёт.
import { describe, it, expect, vi } from 'vitest';
import type { ConceptModeLink, ConceptSchemaLink } from '../../../../../shared/src/apiTypes';
import { emptyModeLink } from '../../../../../shared/src/therapy/conceptGraph/modeLinks';
import { emptySchemaLink } from '../../../../../shared/src/therapy/conceptGraph/schemaLinks';
import { guideJournal } from './guideJournal';

const TODAY = '2026-11-07';
const MODE = { kind: 'mode', id: 'vulnerable_child' } as const;
const SCHEMA = { kind: 'schema', id: 'abandonment' } as const;

function setup(modeLinks: ConceptModeLink[] = [], schemaLinks: ConceptSchemaLink[] = []) {
  const graph = { source: { modeLinks, schemaLinks }, onChangeLink: vi.fn(), onChangeSchemaLink: vi.fn() };
  const onMarked = vi.fn();
  return { graph, onMarked, journal: guideJournal(graph, onMarked, () => TODAY) };
}

describe('guideJournal', () => {
  it('режим: отметка дня — правка связи режима с done, остальные поля связи на месте, событие одно', () => {
    const link = { ...emptyModeLink('vulnerable_child'), alias: 'Маленькая' };
    const { graph, onMarked, journal } = setup([link]);
    expect(journal.markedToday('chairwork', MODE)).toBe(false);
    journal.toggleToday('chairwork', MODE);
    expect(graph.onChangeLink).toHaveBeenCalledWith({ ...link, done: [{ techniqueId: 'chairwork', day: TODAY }] });
    expect(graph.onChangeSchemaLink).not.toHaveBeenCalled();
    expect(onMarked).toHaveBeenCalledTimes(1);
  });

  it('повторный тап в тот же день снимает сегодняшнюю отметку, прошлую оставляет, события нет', () => {
    const done = [{ techniqueId: 'chairwork', day: '2026-11-01' }, { techniqueId: 'chairwork', day: TODAY }];
    const { graph, onMarked, journal } = setup([{ ...emptyModeLink('vulnerable_child'), done }]);
    expect(journal.markedToday('chairwork', MODE)).toBe(true);
    expect(journal.marksOf(MODE)).toEqual(done);
    journal.toggleToday('chairwork', MODE);
    expect(graph.onChangeLink).toHaveBeenCalledWith(expect.objectContaining({ done: [done[0]] }));
    expect(onMarked).not.toHaveBeenCalled();
  });

  it('схема без связи: связь создаётся из пустой заготовки с отметкой', () => {
    const { graph, onMarked, journal } = setup([], []);
    expect(journal.marksOf(SCHEMA)).toBeUndefined();
    journal.toggleToday('imagery_rescripting', SCHEMA);
    expect(graph.onChangeSchemaLink).toHaveBeenCalledWith({
      ...emptySchemaLink('abandonment'),
      done: [{ techniqueId: 'imagery_rescripting', day: TODAY }],
    });
    expect(graph.onChangeLink).not.toHaveBeenCalled();
    expect(onMarked).toHaveBeenCalledTimes(1);
  });

  it('отметки режима и схемы не смешиваются', () => {
    const { journal } = setup(
      [{ ...emptyModeLink('vulnerable_child'), done: [{ techniqueId: 'chairwork', day: TODAY }] }],
      [emptySchemaLink('abandonment')],
    );
    expect(journal.markedToday('chairwork', MODE)).toBe(true);
    expect(journal.markedToday('chairwork', SCHEMA)).toBe(false);
  });
});
