// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuideBetweenSessions } from './GuideBetweenSessions';

const items = [{ kind: 'custom' as const, title: 'Письмо', text: 'Написать и не отправлять' }];

// «+ В план» одно — в строке названия; рядом с «Дать заданием» — в ряду действий, после главной кнопки.
describe('GuideBetweenSessions: где стоит «В план»', () => {
  it('без «Дать заданием» — в строке названия', () => {
    render(<GuideBetweenSessions items={items} onPlan={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'В план: Письмо' }).closest('.gd-card-head')).not.toBeNull();
  });

  it('с «Дать заданием» — в ряду действий, вторым', () => {
    render(<GuideBetweenSessions items={items} onPlan={vi.fn()} onAssign={vi.fn()} />);
    const acts = screen.getByRole('button', { name: 'В план: Письмо' }).closest('.gd-acts');
    expect([...(acts?.querySelectorAll('button') ?? [])].map((b) => b.getAttribute('aria-label'))).toEqual(['Дать заданием: Письмо', 'В план: Письмо']);
  });
});
