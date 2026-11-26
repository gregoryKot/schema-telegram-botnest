// @vitest-environment jsdom
// Тихая ссылка «что это?» у заголовка раздела настроек и лист «Зачем это».
import { describe, it, expect, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { SSection } from './ui';
import { SettingsInfoHelp } from './SettingsInfoHelp';

afterEach(cleanup);
const help = () => screen.getByRole('button', { name: 'что это?' });
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const withForm = (form: 'ty' | 'vy', node: React.ReactNode) => (
  <AddressFormContext.Provider value={{ form, setForm: () => {} }}>{node}</AddressFormContext.Provider>
);

describe('SettingsInfoHelp', () => {
  it('лист закрыт, пока не нажали «что это?»; нажатие открывает объяснение, фон закрывает', async () => {
    render(<SettingsInfoHelp infoKey="notify" />);
    expect(screen.queryByText('Зачем уведомления')).toBeNull();
    fireEvent.click(help());
    expect(screen.getByText('Зачем уведомления')).toBeTruthy();
    expect(screen.getByText('Итоги дня')).toBeTruthy();
    fireEvent.click(document.querySelector('.sheet-modal')!);
    await waitFor(() => expect(screen.queryByText('Зачем уведомления')).toBeNull());
  });

  it('кнопка — текст «что это?» с классом st-help (зона 44 — в sheet-settings.css, paperPrimitives.test.ts)', () => {
    render(<SettingsInfoHelp infoKey="pair" />);
    expect(help().className).toBe('st-help');
  });

  it('форма «вы»: текст на «вы», без «ты»-форм', () => {
    render(withForm('vy', <SettingsInfoHelp infoKey="therapist" />));
    fireEvent.click(help());
    expect(screen.getByText('Зачем подключать терапевта')).toBeTruthy();
    const box = document.querySelector('.sheet-modal-box')!;
    expect(box.textContent).toMatch(/Если вы работаете/);
    expect(hasTyForms(box.textContent ?? '')).toBe(false);
  });

  it('форма «ты»', () => {
    render(withForm('ty', <SettingsInfoHelp infoKey="pair" />));
    fireEvent.click(help());
    expect(document.querySelector('.sheet-modal-box')!.textContent).toMatch(/Ты и друг/);
  });
});

describe('SSection — слот help', () => {
  it('«что это?» стоит рядом с названием раздела', () => {
    render(<SSection id="s-x" label="Раздел" help={<SettingsInfoHelp infoKey="notify" />}>тело</SSection>);
    expect(screen.getByText('Раздел')).toBeTruthy();
    expect(help()).toBeTruthy();
  });
  it('без help кнопки нет', () => {
    render(<SSection id="s-x" label="Раздел">тело</SSection>);
    expect(screen.queryByRole('button', { name: 'что это?' })).toBeNull();
  });
});
