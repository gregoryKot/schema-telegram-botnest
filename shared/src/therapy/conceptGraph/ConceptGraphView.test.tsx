// @vitest-environment jsdom
// Схема случая клиента (только чтение): та же диаграмма, что у терапевта, но
// без «+», редакторов и подсказок «чего не хватает»; тап по фигуре подсвечивает
// её связи, пустая секция — заготовка без действия, цикл режимов на месте.
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConceptGraphView } from './ConceptGraphView';
import { RICH } from './diagram/diagram.test-helpers';

const nodeEl = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-node="${id}"]`)!;

describe('ConceptGraphView — схема клиента только для чтения', () => {
  it('рисует режимы и схемы клиента, без кнопок «+» и подсказок терапевту', () => {
    render(
      <ConceptGraphView
        fields={{ ...RICH, modeTransitions: 'Критик → Отстранённый Защитник' }}
      />,
    );
    expect(nodeEl('mode:punitive_critic')).not.toBeNull();
    expect(nodeEl('schema:emotional_inhibition')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^\+ / })).toBeNull();
    expect(screen.queryByText(/Подсказки по схеме/)).toBeNull();
    expect(screen.getByText('Критик → Отстранённый Защитник')).toBeTruthy();
  });

  it('тап по режиму подсвечивает его связи, редактор не открывается', () => {
    render(<ConceptGraphView fields={RICH} />);
    const critic = nodeEl('mode:punitive_critic');
    expect(critic.getAttribute('aria-pressed')).toBe('false');
    expect(critic.hasAttribute('aria-expanded')).toBe(false);
    fireEvent.click(critic);
    expect(critic.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('textarea, input')).toBeNull();
    // Несвязанная фигура гаснет, связанная схема — нет.
    expect(nodeEl('mode:healthy_adult').style.opacity).not.toBe('1');
    expect(nodeEl('schema:emotional_inhibition').style.opacity).toBe('1');
  });

  it('пустые секции — заготовки без действия; истоков без текста нет', () => {
    render(<ConceptGraphView fields={{ modeIds: [], schemaIds: [] }} />);
    const placeholder = nodeEl('placeholder:schemas');
    expect(placeholder.disabled).toBe(true);
    expect(document.querySelector('[data-node^="origin:"]')).toBeNull();
  });

  it('связи без истоков и задач терапии (как отдаёт сервер) рисуются', () => {
    render(
      <ConceptGraphView
        fields={{
          modeIds: ['vulnerable_child'],
          modeLinks: [
            {
              modeId: 'vulnerable_child',
              alias: 'Маленькая Аня',
              schemaIds: [],
              needIds: [],
              manifest: 'Страшно',
            },
          ],
          schemaLinks: [
            { schemaId: 'abandonment', belief: 'Меня бросят', needIds: [] },
          ],
          schemaIds: ['abandonment'],
        }}
      />,
    );
    expect(screen.getByText('Маленькая Аня')).toBeTruthy();
    expect(screen.getByText('Меня бросят')).toBeTruthy();
  });
});
