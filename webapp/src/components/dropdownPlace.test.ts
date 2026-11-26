import { describe, it, expect } from 'vitest';
import { placeMenu } from './dropdownPlace';

const phone = { width: 390, height: 844 };

describe('placeMenu', () => {
  it('под якорем, когда места хватает', () => {
    expect(placeMenu({ left: 20, top: 100, bottom: 144 }, { width: 220, height: 280 }, phone)).toEqual({ left: 20, top: 148 });
  });
  it('не выходит за правый край экрана', () => {
    expect(placeMenu({ left: 300, top: 100, bottom: 144 }, { width: 260, height: 100 }, phone).left).toBe(390 - 8 - 260);
  });
  it('меню шире экрана прижато к левому полю', () => {
    expect(placeMenu({ left: 300, top: 100, bottom: 144 }, { width: 500, height: 100 }, phone).left).toBe(8);
  });
  it('внизу экрана открывается над якорем', () => {
    expect(placeMenu({ left: 20, top: 700, bottom: 744 }, { width: 220, height: 280 }, phone).top).toBe(700 - 4 - 280);
  });
  it('не влезает ни вниз, ни вверх — прижато к нижнему краю', () => {
    expect(placeMenu({ left: 20, top: 200, bottom: 244 }, { width: 220, height: 700 }, phone).top).toBe(844 - 8 - 700);
  });
});
