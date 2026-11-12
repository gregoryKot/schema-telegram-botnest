// @vitest-environment jsdom
// SignGroup: шапка листа группы. Прежний вид (клиент) — h3 и секция без имени; «Справочник» терапевта
// берёт h2 и aria-label, а лист без подписи и знака (техники) стоит без шапки.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignGroup } from './SignGroup';

describe('SignGroup', () => {
  it('по умолчанию — h3 со знаком и подписью, секция без имени', () => {
    const { container } = render(<SignGroup look={{ hue: 310, sign: 'looming' }} title="Критикующие режимы"><p>строка</p></SignGroup>);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toContain('Критикующие');
    expect(container.querySelectorAll('.sg-head svg')).toHaveLength(1);
    expect(screen.queryByRole('region')).toBeNull();
    expect(container.querySelector<HTMLElement>('.sg-group')!.style.getPropertyValue('--h')).toBe('310');
  });

  it('label и headAs — область с именем и заголовок h2', () => {
    render(<SignGroup look={{ hue: 28, sign: 'child_care' }} title="Детские режимы" label="Детские режимы" headAs="h2"><p>строка</p></SignGroup>);
    expect(screen.getByRole('region', { name: 'Детские режимы' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('без подписи и знака — лист без шапки, строки на месте', () => {
    const { container } = render(<SignGroup look={{ hue: 45 }} rowsClassName="gr-rows"><p>строка</p></SignGroup>);
    expect(container.querySelector('.sg-head')).toBeNull();
    expect(container.querySelector('.sg-rows.gr-rows')!.textContent).toBe('строка');
  });
});
