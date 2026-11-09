// @vitest-environment jsdom
// «Зачем это всё», три действия: те же бумага и знак, что у квадратов главной (ENTITY_LOOK) —
// новичок узнаёт на главной то, о чём прочитал; лист рассказывает, а не ведёт (не кнопка).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { WhyThree } from './WhyThree';

describe('WhyThree', () => {
  it('три листа: трекер, «Что случилось», дневник — бумага сущности и её знак', () => {
    render(<WhyThree />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('h2')?.textContent)).toEqual(['Трекер', 'Что случилось', 'Дневник']);
    const hues = items.map((li) => li.style.getPropertyValue('--h'));
    expect(hues).toEqual([ENTITY_LOOK.tracker.hue, ENTITY_LOOK.case.hue, ENTITY_LOOK.diary.hue].map(String));
    for (const li of items) expect(li.querySelector('svg.pp-art--square[aria-hidden="true"]')).toBeTruthy();
  });
  it('листы — рассказ, не действие: ни кнопок, ни ссылок', () => {
    const { container } = render(<WhyThree />);
    expect(container.querySelectorAll('button, a').length).toBe(0);
  });
});
