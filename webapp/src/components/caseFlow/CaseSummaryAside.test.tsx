// @vitest-environment jsdom
// «Что собрали» разбора: на шагах у «Момент» — лента разбора; на итоге лента уже в сцене-герое
// (SceneCaseFound), и второй ленты ~200px ниже быть не должно (ревью g2 r3) — `signs={false}`.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CaseSummaryAside } from './CaseSummaryAside';

const ROWS = [
  { label: 'Момент', text: 'Сообщение прочитано, ответа нет.' },
  { label: 'Внутри', text: 'Страшно, тревожно' },
];

describe('CaseSummaryAside', () => {
  it('на шагах: колонка знаков, лента — только у «Момент»', () => {
    const { container } = render(<CaseSummaryAside rows={ROWS} className="cq-summary--aside" />);
    const signs = [...container.querySelectorAll('.cq-row-sign')];
    expect(signs).toHaveLength(2);
    expect(signs[0].querySelector('svg')).not.toBeNull();
    expect(signs[1].querySelector('svg')).toBeNull();
  });

  it('на итоге (signs={false}): ни знаков, ни колонки под них; ответы на месте', () => {
    const { container, getByText } = render(<CaseSummaryAside rows={ROWS} signs={false} />);
    expect(container.querySelector('.cq-row-sign')).toBeNull();
    expect(container.querySelector('section')!.className).toBe('cq-summary cq-summary--nosign');
    expect(getByText('Страшно, тревожно')).toBeTruthy();
  });

  it('нет ответов — нет листа', () => {
    expect(render(<CaseSummaryAside rows={[]} />).container.firstChild).toBeNull();
  });
});
