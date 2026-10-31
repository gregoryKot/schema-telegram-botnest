// @vitest-environment jsdom
// «06 Переключение режимов»: цепочка из режимов клиента, а не одна константа
// на всех (QA 2026-10-26: «Уязвимый Ребёнок → Карающий Критик → Здоровый
// Взрослый» висело и у клиента с совсем другими режимами).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { buildModeChain, ConceptModeIdsContext } from './modeChain';
import { ConceptModes } from './ConceptSectionsText';

afterEach(cleanup);

describe('buildModeChain', () => {
  it('по одному режиму клиента на шаг в клиническом порядке', () => {
    const chain = buildModeChain(['healthy_adult', 'detached_protector', 'angry_child', 'demanding_critic']);
    expect(chain.map(s => [s.kind, s.modeId])).toEqual([
      ['Ребёнок', 'angry_child'],
      ['Критик', 'demanding_critic'],
      ['Копинг', 'detached_protector'],
      ['Здоровый', 'healthy_adult'],
    ]);
  });

  it('в группе берётся первый отмеченный; у здоровых — Здоровый Взрослый', () => {
    const chain = buildModeChain(['lonely_child', 'vulnerable_child', 'happy_child', 'healthy_adult']);
    expect(chain.map(s => s.modeId)).toEqual(['lonely_child', 'healthy_adult']);
  });

  it('нет режима критика — шага критика нет, ничего не выдумывается', () => {
    const chain = buildModeChain(['vulnerable_child', 'compliant_surrenderer']);
    expect(chain.map(s => s.kind)).toEqual(['Ребёнок', 'Копинг']);
  });

  it('меньше двух шагов или неизвестные id — цепочки нет', () => {
    expect(buildModeChain([])).toEqual([]);
    expect(buildModeChain(['vulnerable_child', 'lonely_child'])).toEqual([]);
    expect(buildModeChain(['custom_x', 'nope'])).toEqual([]);
  });
});

describe('ConceptModes', () => {
  const field = { value: '', onChange: () => {}, placeholder: '' };

  it('рисует режимы клиента', () => {
    render(
      <ConceptModeIdsContext.Provider value={['angry_child', 'detached_protector']}>
        <ConceptModes {...field} />
      </ConceptModeIdsContext.Provider>,
    );
    expect(screen.getByText('Сердитый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Отстранённый Защитник')).toBeTruthy();
    expect(screen.queryByText('Карающий Критик')).toBeNull();
  });

  it('без режимов — только поле, без выдуманной цепочки', () => {
    const { container } = render(<ConceptModes {...field} />);
    expect(container.querySelector('.tcp-chain')).toBeNull();
    expect(container.querySelector('textarea')).toBeTruthy();
  });
});
