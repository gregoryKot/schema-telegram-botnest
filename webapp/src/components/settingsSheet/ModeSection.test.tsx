// @vitest-environment jsdom
// «Перестать быть специалистом» живёт внизу листа, в разделе «Данные» перед «Удалить аккаунт»
// (b25: опасные действия вместе, не первой заметной кнопкой листа). До этого — в «Режиме»
// (хвост #902), ещё раньше — в «Оформлении».
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModeSection } from './ModeSection';
import { AppearanceSection } from './AppearanceSection';
import { DataSection } from './DataSection';

vi.mock('../../api', () => ({ api: { getYsqHistory: vi.fn().mockResolvedValue([]), getYsqProgress: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../apiClient', () => ({ authedFetch: vi.fn() }));

const sectionOf = (el: HTMLElement) => el.closest('section')?.querySelector('.st-sec-head')?.id;

describe('снятие роли специалиста — раздел «Данные»', () => {
  it('кнопка стоит в «Данных» перед «Удалить аккаунт», подтверждение — там же', async () => {
    const onResign = vi.fn().mockResolvedValue(undefined);
    render(<DataSection onResign={onResign} />);
    const btn = screen.getByRole('button', { name: 'Перестать быть специалистом' });
    expect(sectionOf(btn)).toBe('s-data');
    const del = screen.getByRole('button', { name: /Удалить аккаунт/ });
    expect(btn.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(btn);
    expect(onResign).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Снять роль' });
    expect(sectionOf(confirm)).toBe('s-data');

    fireEvent.click(confirm);
    await waitFor(() => expect(onResign).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Перестать быть специалистом' })).toBeTruthy());
  });

  it('без onResign кнопки нет', () => {
    render(<DataSection />);
    expect(screen.queryByText('Перестать быть специалистом')).toBeNull();
  });

  it('в «Режиме» снятия роли больше нет', () => {
    render(<ModeSection therapistMode onSelect={vi.fn()} onOpenAccount={vi.fn()} />);
    expect(screen.queryByText('Перестать быть специалистом')).toBeNull();
  });

  it('в «Оформлении» снятия роли нет', () => {
    render(<AppearanceSection onSaved={vi.fn()} />);
    expect(screen.queryByText('Перестать быть специалистом')).toBeNull();
  });
});
