// @vitest-environment jsdom
// «Перестать быть специалистом» живёт в разделе «Режим», а не в «Оформлении»
// (docs/open/frontend-ux.md, хвост #902): отказ от роли — про режим, не про вид.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModeSection } from './ModeSection';
import { AppearanceSection } from './AppearanceSection';

const sectionOf = (el: HTMLElement) => el.closest('section')?.querySelector('.st-sec-head')?.id;

describe('ModeSection — снятие роли специалиста', () => {
  it('кнопка стоит в разделе «Режим», подтверждение — там же', async () => {
    const onResign = vi.fn().mockResolvedValue(undefined);
    render(<ModeSection therapistMode onSelect={vi.fn()} onOpenAccount={vi.fn()} onResign={onResign} />);
    const btn = screen.getByRole('button', { name: 'Перестать быть специалистом' });
    expect(sectionOf(btn)).toBe('s-mode');

    fireEvent.click(btn);
    expect(onResign).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Снять роль' });
    expect(sectionOf(confirm)).toBe('s-mode');

    fireEvent.click(confirm);
    await waitFor(() => expect(onResign).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Перестать быть специалистом' })).toBeTruthy());
  });

  it('без onResign кнопки нет', () => {
    render(<ModeSection therapistMode onSelect={vi.fn()} onOpenAccount={vi.fn()} />);
    expect(screen.queryByText('Перестать быть специалистом')).toBeNull();
  });

  it('в «Оформлении» снятия роли нет', () => {
    render(<AppearanceSection onSaved={vi.fn()} />);
    expect(screen.queryByText('Перестать быть специалистом')).toBeNull();
  });
});
