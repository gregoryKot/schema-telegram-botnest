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
    expect(screen.getByText('Отчуждение и отвержение')).toBeTruthy();
    expect(screen.queryByText('Нарушение автономии')).toBeNull();
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
    fireEvent.click(screen.getByText('Эмоциональная депривация'));
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
    expect(screen.queryByText('Эмоциональная депривация')).toBeNull();

    fireEvent.click(screen.getByText('Отчуждение и отвержение'));
    expect(screen.getByText('Эмоциональная депривация')).toBeTruthy();

    fireEvent.click(screen.getByText('Отчуждение и отвержение'));
    expect(screen.queryByText('Эмоциональная депривация')).toBeNull();
  });
});
