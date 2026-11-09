// @vitest-environment jsdom
// «Обращение» в настройках: форма ставится сразу, а на отказе сохранения
// откатывается вместе с переключателем (docs/open/frontend-ux.md, хвост
// разбора no-floating-promises: раньше переключатель возвращался, а интерфейс
// уже говорил новой формой до следующей загрузки настроек).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { AddressSection } from './NameAddressSections';
import type { UserSettings } from '../../api';

const settings = { addressForm: 'ty' } as UserSettings;

function renderSection(patch: (u: Partial<UserSettings>) => Promise<boolean>) {
  const setForm = vi.fn();
  render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm }}>
      <AddressSection settings={settings} patch={patch} />
    </AddressFormContext.Provider>,
  );
  return setForm;
}

describe('AddressSection — откат формы на отказе сохранения', () => {
  it('сервер не сохранил — форма возвращается к прежней', async () => {
    const patch = vi.fn().mockResolvedValue(false);
    const setForm = renderSection(patch);
    fireEvent.click(screen.getByRole('button', { name: 'На «вы»' }));
    expect(patch).toHaveBeenCalledWith({ addressForm: 'vy' });
    await waitFor(() => expect(setForm).toHaveBeenLastCalledWith('ty'));
    expect(setForm.mock.calls.map((c) => c[0])).toEqual(['vy', 'ty']);
  });

  it('контроль: сохранилось — форма остаётся новой', async () => {
    const patch = vi.fn().mockResolvedValue(true);
    const setForm = renderSection(patch);
    fireEvent.click(screen.getByRole('button', { name: 'На «вы»' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    await Promise.resolve();
    expect(setForm.mock.calls.map((c) => c[0])).toEqual(['vy']);
  });
});
