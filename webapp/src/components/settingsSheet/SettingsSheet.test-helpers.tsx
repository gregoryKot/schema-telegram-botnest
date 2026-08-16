// Общий тестовый сетап для SettingsSheet.tsx и его секций после распила
// (правило №10 — файл-лимит): DataSection и BecomeTherapistSection
// проверяются и как части родителя (SettingsSheet.test.tsx — сценарий
// целиком), и как самостоятельные модули (settingsSheet/*.test.tsx — то же
// поведение в изоляции). Обвязка (моки, шаги действия) — общая, ассерты у
// каждого теста свои и не трогаются. Образец: AppShell.test-helpers.tsx.
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';

/** Оборачивает узел в AddressFormContext.Provider — тесты формы обращения
 *  (правило CLAUDE.md) заводили такой провайдер в каждом файле вручную. */
export function withAddressForm(
  node: ReactNode,
  form: 'ty' | 'vy',
  setForm: (f: 'ty' | 'vy') => void = vi.fn(),
) {
  return (
    <AddressFormContext.Provider value={{ form, setForm }}>{node}</AddressFormContext.Provider>
  );
}

const originalLocation = window.location;

/** Подменяет window.location мокнутым reload() — тест удаления аккаунта
 *  проверяет, что страница перезагружается (или нет, при отказе api).
 *  Вызывать в beforeEach, парная restoreLocation() — в afterEach. */
export function mockLocationReload(): ReturnType<typeof vi.fn> {
  const reloadSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload: reloadSpy },
  });
  return reloadSpy;
}

export function restoreLocation() {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
}

/** Три ключа localStorage для теста «удаление чистит хранилище, кроме темы
 *  и cookie-согласия» — тема и cookie переживают удаление осознанно. */
export function seedWipeTestStorage() {
  localStorage.setItem('app_theme', 'dark');
  localStorage.setItem('cookie_consent', 'accepted');
  localStorage.setItem('some_other_key', 'should-be-wiped');
}

/** Открывает лист удаления аккаунта (первый шаг — предупреждение). */
export function openDeleteSheet() {
  fireEvent.click(screen.getByText('Удалить все данные'));
}

/** Доводит удаление аккаунта до конца: открыть лист → «Удалить» → «Да,
 *  удалить всё навсегда». Промежуточные шаги проверяются отдельными
 *  тестами — здесь только сквозной путь до вызова api. */
export function confirmAccountDeletion() {
  openDeleteSheet();
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  fireEvent.click(screen.getByText('Да, удалить всё навсегда'));
}

/** Заполняет форму заявки на специалиста валидными значениями по
 *  умолчанию, поля можно переопределить. */
export function fillTherapistRequestForm(overrides: {
  fio?: string;
  qualification?: string;
  contacts?: string;
} = {}) {
  const { fio = 'Иван Иванов', qualification = 'Психолог', contacts = '@ivan' } = overrides;
  fireEvent.change(screen.getByPlaceholderText('ФИО'), { target: { value: fio } });
  fireEvent.change(
    screen.getByPlaceholderText('Квалификация: образование, направление, опыт, сертификаты'),
    { target: { value: qualification } },
  );
  fireEvent.change(screen.getByPlaceholderText('Контакты: сайт, @telegram, b17 и т.д.'), {
    target: { value: contacts },
  });
}
