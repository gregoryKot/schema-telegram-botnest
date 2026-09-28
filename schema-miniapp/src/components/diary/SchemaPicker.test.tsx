// @vitest-environment jsdom
// SchemaPicker — выбор схем по доменам в дневнике (54% покрытия). Проверяем:
// фильтрацию по activeSchemaIds (домены без совпадений скрываются целиком),
// клик по схеме вызывает onToggle, клик по заголовку домена открывает/
// закрывает список.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaPicker } from './SchemaPicker';

afterEach(cleanup);

describe('SchemaPicker — фильтр по активным схемам (useFiltered)', () => {
  it('домены без совпадений в activeSchemaIds не рендерятся вовсе', () => {
    render(
      <SchemaPicker
        schemaIds={['emotional_deprivation']}
        onToggle={vi.fn()}
        useFiltered
        activeSchemaIds={['emotional_deprivation']}
        showAllSchemas={false}
        onToggleShowAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Разобщение / Отвержение')).toBeTruthy();
    expect(screen.queryByText('Нарушенная автономия')).toBeNull();
  });

  it('клик по отфильтрованной схеме вызывает onToggle с её id', () => {
    const onToggle = vi.fn();
    render(
      <SchemaPicker
        schemaIds={['emotional_deprivation']}
        onToggle={onToggle}
        useFiltered
        activeSchemaIds={['emotional_deprivation']}
        showAllSchemas={false}
        onToggleShowAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Эмоциональная депривированность'));
    expect(onToggle).toHaveBeenCalledWith('emotional_deprivation');
  });
});

describe('SchemaPicker — заголовок домена открывает/закрывает список', () => {
  it('клик по заголовку показывает схемы домена, повторный клик скрывает', () => {
    render(
      <SchemaPicker
        schemaIds={[]}
        onToggle={vi.fn()}
        showAllSchemas={false}
        onToggleShowAll={vi.fn()}
      />,
    );
    expect(screen.queryByText('Эмоциональная депривированность')).toBeNull();

    fireEvent.click(screen.getByText('Разобщение / Отвержение'));
    expect(screen.getByText('Эмоциональная депривированность')).toBeTruthy();

    fireEvent.click(screen.getByText('Разобщение / Отвержение'));
    expect(screen.queryByText('Эмоциональная депривированность')).toBeNull();
  });
});
