// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { getSchemaById } from '../../schemaTherapyData';
import { SchemaPills } from './SchemaPills';
import { nodeSchemaIds } from './nodeSchemaIds';
import { ModeMapConceptContext, type ClientConceptState } from './clientConceptContext';

afterEach(() => cleanup());

const link = (modeId: string, schemaIds: string[]) =>
  ({ modeId, alias: '', schemaIds, needIds: [], origin: '', manifest: '', strategy: '' });
const concept = (links: ReturnType<typeof link>[]): ClientConceptState =>
  ({ schemaIds: [], modeIds: [], modeLinks: links });

function renderPills(state: ClientConceptState, props: Partial<Parameters<typeof SchemaPills>[0]> = {}) {
  return render(
    <ModeMapConceptContext.Provider value={state}>
      <SchemaPills modeId="vulnerable_child" fontSize={10} {...props} />
    </ModeMapConceptContext.Provider>,
  );
}

describe('nodeSchemaIds', () => {
  it('своя схема первой, дубль из связей не повторяется, неизвестные id отбрасываются', () => {
    expect(nodeSchemaIds('abandonment', ['mistrust', 'abandonment', 'no_such_schema'])).toEqual(['abandonment', 'mistrust']);
  });
  it('без своей схемы и связей — пусто', () => {
    expect(nodeSchemaIds(undefined, [])).toEqual([]);
  });
});

describe('SchemaPills — схемы клиента на узле режима', () => {
  it('показывает названия схем из связей режима', () => {
    renderPills(concept([link('vulnerable_child', ['abandonment', 'mistrust'])]));
    expect(screen.getByText('Покинутость / Нестабильность')).toBeTruthy();
    expect(screen.getByText('Недоверие / Ожидание жестокого обращения')).toBeTruthy();
  });

  it('связи другого режима не показываются', () => {
    const { container } = renderPills(concept([link('angry_child', ['abandonment'])]));
    expect(container.textContent).toBe('');
  });

  it('без концептуализации (грузится, сбой, нет клиента) показывает только собственную схему узла', () => {
    for (const state of [null, 'failed'] as ClientConceptState[]) {
      const { container } = renderPills(state, { schemaId: 'abandonment' });
      expect(container.textContent).toBe('Покинутость / Нестабильность');
      cleanup();
    }
    const { container } = renderPills(null);
    expect(container.textContent).toBe('');
  });

  it('схема узла, уже стоящая в связях, не дублируется', () => {
    renderPills(concept([link('vulnerable_child', ['abandonment'])]), { schemaId: 'abandonment' });
    expect(screen.getAllByText('Покинутость / Нестабильность')).toHaveLength(1);
  });

  it('больше трёх схем — три таблетки и «+N»', () => {
    renderPills(concept([link('vulnerable_child', ['abandonment', 'mistrust', 'emotional_deprivation', 'defectiveness', 'failure'])]));
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.queryByText(getSchemaById('failure')!.name)).toBeNull();
    expect(screen.queryByText(getSchemaById('defectiveness')!.name)).toBeNull();
    expect(screen.getByText('Эмоциональная депривация')).toBeTruthy();
  });

  it('ровно три схемы — без «+N»', () => {
    renderPills(concept([link('vulnerable_child', ['abandonment', 'mistrust', 'failure'])]));
    expect(screen.queryByText(/^\+\d/)).toBeNull();
  });
});
