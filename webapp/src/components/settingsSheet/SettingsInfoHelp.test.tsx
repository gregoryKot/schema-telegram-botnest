// @vitest-environment jsdom
// «?» у заголовка раздела настроек и лист «Зачем это» (паритет с InfoOverlays мини-аппа).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { SSection } from './ui';
import { SettingsInfoHelp } from './SettingsInfoHelp';

afterEach(cleanup);

const withForm = (form: 'ty' | 'vy', node: React.ReactNode) => (
  <AddressFormContext.Provider value={{ form, setForm: () => {} }}>{node}</AddressFormContext.Provider>
);

describe('SettingsInfoHelp', () => {
  it('лист закрыт, пока не нажали «?»; нажатие открывает объяснение, фон закрывает', () => {
    render(<SettingsInfoHelp infoKey="notify" />);
    expect(screen.queryByText('Зачем уведомления')).toBeNull();
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(screen.getByText('Зачем уведомления')).toBeTruthy();
    expect(screen.getByText('Итоги дня')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(screen.queryByText('Зачем уведомления')).toBeNull();
  });

  it('зона нажатия «?» не меньше 44×44', () => {
    render(<SettingsInfoHelp infoKey="pair" />);
    const btn = screen.getByLabelText('Пояснение') as HTMLElement;
    expect(btn.style.width).toBe('44px');
    expect(btn.style.height).toBe('44px');
  });

  it('форма «вы»: текст на «вы», без «ты»-форм', () => {
    render(withForm('vy', <SettingsInfoHelp infoKey="therapist" />));
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(screen.getByText('Зачем подключать терапевта')).toBeTruthy();
    const box = document.querySelector('.sheet-modal-box')!;
    expect(box.textContent).toMatch(/Если вы работаете/);
    expect(hasTyForms(box.textContent ?? '')).toBe(false);
  });

  it('форма «ты»', () => {
    render(withForm('ty', <SettingsInfoHelp infoKey="pair" />));
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(document.querySelector('.sheet-modal-box')!.textContent).toMatch(/Ты и друг/);
  });
});

describe('SSection — слот help', () => {
  it('«?» стоит рядом с названием раздела', () => {
    render(<SSection id="s-x" label="Раздел" help={<SettingsInfoHelp infoKey="notify" />}>тело</SSection>);
    expect(screen.getByText('Раздел')).toBeTruthy();
    expect(screen.getByLabelText('Пояснение')).toBeTruthy();
  });
  it('без help кнопки нет', () => {
    render(<SSection id="s-x" label="Раздел">тело</SSection>);
    expect(screen.queryByLabelText('Пояснение')).toBeNull();
  });
});
