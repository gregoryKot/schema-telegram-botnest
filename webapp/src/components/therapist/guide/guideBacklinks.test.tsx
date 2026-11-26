// @vitest-environment jsdom
// Обратная сторона связей на листах справочника: схемы в «Связано» у режима (тап — лист схемы) и
// «Где применяется» у техники (чипы режимов и схем, запросы строкой); без связей раздела нет. Содержание — фикстура.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ModeGuideSheet } from './ModeGuideSheet';
import { TechniqueSheet } from './TechniqueSheet';
import { FIXTURE_TECHNIQUES, FIXTURE_VIEW } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const show = (node: ReactNode) => {
  render(<MemoryRouter>{node}</MemoryRouter>);
  const more = screen.queryByRole('button', { name: 'Подробнее' });
  if (more) fireEvent.click(more);
};
const SCHEMAS = [{ id: 'abandonment', name: 'Покинутость' }, { id: 'defectiveness', name: 'Дефективность/Стыд' }];

describe('ModeGuideSheet: схемы в «Связано»', () => {
  it('схемы чипами, тап открывает лист схемы', () => {
    const onOpenSchema = vi.fn();
    show(<ModeGuideSheet modeName="Уязвимый Ребёнок" view={{ ...FIXTURE_VIEW, schemas: SCHEMAS }} onOpenSchema={onOpenSchema} onOpenTechnique={() => {}} onClose={() => {}} />);
    const part = screen.getByRole('region', { name: 'Схемы' });
    fireEvent.click(within(part).getByRole('button', { name: 'Дефективность/Стыд' }));
    expect(onOpenSchema).toHaveBeenCalledWith('defectiveness');
  });

  it('без перехода — названия строкой', () => {
    show(<ModeGuideSheet modeName="Уязвимый Ребёнок" view={{ ...FIXTURE_VIEW, schemas: SCHEMAS }} onOpenTechnique={() => {}} onClose={() => {}} />);
    expect(within(screen.getByRole('region', { name: 'Схемы' })).getByText('Покинутость, Дефективность/Стыд')).toBeTruthy();
  });

  it('схем нет — блока «Связано» нет', () => {
    show(<ModeGuideSheet modeName="Уязвимый Ребёнок" view={FIXTURE_VIEW} onOpenSchema={() => {}} onOpenTechnique={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('region', { name: 'Схемы' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Связано' })).toBeNull();
  });
});

describe('TechniqueSheet: «Где применяется»', () => {
  const technique = FIXTURE_TECHNIQUES[0];

  it('режимы и схемы — чипы, тап открывает их лист; запросы — строкой', () => {
    const [onOpenMode, onOpenSchema] = [vi.fn(), vi.fn()];
    show(<TechniqueSheet technique={technique} onClose={() => {}} onOpenMode={onOpenMode} onOpenSchema={onOpenSchema} usages={[
      { kind: 'mode', lead: 'Режимы', items: [{ id: 'vulnerable_child', name: 'Уязвимый Ребёнок' }] },
      { kind: 'schema', lead: 'Схемы', items: SCHEMAS },
      { kind: 'concern', lead: 'Запросы', items: [{ id: 'a', name: 'Тревога' }, { id: 'b', name: 'Выгорание' }] },
    ]} />);
    const used = within(screen.getByRole('region', { name: 'Где применяется' }));
    fireEvent.click(used.getByRole('button', { name: 'Уязвимый Ребёнок' }));
    fireEvent.click(used.getByRole('button', { name: 'Покинутость' }));
    expect(onOpenMode).toHaveBeenCalledWith('vulnerable_child');
    expect(onOpenSchema).toHaveBeenCalledWith('abandonment');
    expect(within(used.getByRole('region', { name: 'Запросы' })).getByText('Тревога, Выгорание')).toBeTruthy();
  });

  it('техника нигде не зовётся — раздела нет', () => {
    show(<TechniqueSheet technique={{ ...technique, cautions: 'Не в остром кризисе' }} onClose={() => {}} />);
    expect(screen.queryByRole('region', { name: 'Где применяется' })).toBeNull();
  });
});
