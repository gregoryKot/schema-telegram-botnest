// @vitest-environment jsdom
// SettingsSheet — контейнер настроек (0% покрытия), собирает ~15 секций.
// Каждая секция — отдельный файл со своим тестом (правило №10); здесь
// проверяем ТОЛЬКО собственную логику контейнера: скелетон до загрузки,
// переключение view («Назад»/«Закрыть»), четыре параллельные загрузки,
// patch() с «Сохранено ✓», ролевые ветки (CLIENT/THERAPIST скрывают разные
// секции) и три оверлея (export/privacy/delete).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { setHost, createWebHost } from '../../../shared/src/host';
import { SettingsSheet } from './SettingsSheet';

vi.mock('../api', () => ({
  api: {
    getSettings: vi.fn(),
    getPair: vi.fn(),
    getTherapyRelation: vi.fn(),
    getTherapistRequest: vi.fn(),
    updateSettings: vi.fn(),
    createPairInvite: vi.fn(),
    joinPair: vi.fn(),
    leavePair: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./settingsSheet/NotifyViews', () => ({
  NotifySubView: () => null,
}));
vi.mock('./settingsSheet/AppearanceSection', () => ({
  AppearanceSection: () => <div data-testid="appearance-section" />,
}));
vi.mock('./settingsSheet/NotificationsSection', () => ({
  NotificationsSection: () => <div data-testid="notifications-section" />,
}));
vi.mock('./settingsSheet/AddressFormSection', () => ({
  AddressFormSection: ({
    patch,
  }: {
    patch: (u: Record<string, unknown>) => Promise<void>;
  }) => (
    <div data-testid="address-form-section">
      <button onClick={() => patch({ addressForm: 'vy' })}>
        address-form-patch
      </button>
    </div>
  ),
}));
vi.mock('./settingsSheet/TherapistClientSection', () => ({
  TherapistClientSection: () => <div data-testid="therapist-client-section" />,
}));
vi.mock('./settingsSheet/BecomeTherapistSection', () => ({
  BecomeTherapistSection: () => <div data-testid="become-therapist-section" />,
}));
vi.mock('./settingsSheet/TherapistCabinetSection', () => ({
  TherapistCabinetSection: () => (
    <div data-testid="therapist-cabinet-section" />
  ),
}));
vi.mock('./settingsSheet/PartnerSection', () => ({
  PartnerSection: () => <div data-testid="partner-section" />,
}));
vi.mock('./settingsSheet/AboutSection', () => ({
  AboutSection: () => <div data-testid="about-section" />,
}));
vi.mock('./settingsSheet/HomeScreenSection', () => ({
  HomeScreenSection: () => <div data-testid="home-screen-section" />,
}));
vi.mock('./settingsSheet/MiscSections', () => ({
  NameSection: () => <div data-testid="name-section" />,
  ShareSection: () => <div data-testid="share-section" />,
  DataSection: ({
    onPrivacy,
    onDelete,
  }: {
    onPrivacy: () => void;
    onDelete: () => void;
  }) => (
    <div data-testid="data-section">
      <button onClick={onPrivacy}>data-open-privacy</button>
      <button onClick={onDelete}>data-open-delete</button>
    </div>
  ),
}));
vi.mock('./settingsSheet/InfoOverlays', () => ({
  NotifyInfoOverlay: () => <div data-testid="notify-info-overlay" />,
  PairInfoOverlay: () => <div data-testid="pair-info-overlay" />,
  TherapistInfoOverlay: () => <div data-testid="therapist-info-overlay" />,
}));
vi.mock('./settingsSheet/DataOverlays', () => ({
  ExportOverlay: () => <div data-testid="export-overlay" />,
  PrivacyOverlay: () => <div data-testid="privacy-overlay" />,
  DeleteOverlay: () => <div data-testid="delete-overlay" />,
}));

const SETTINGS = {
  notifyEnabled: false,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: false,
  pairCardDismissed: false,
  mySchemaIds: [] as string[],
  myModeIds: [] as string[],
  therapistShareCards: true,
  therapistShareProfile: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSettings.mockResolvedValue(SETTINGS);
  mockApi.getPair.mockResolvedValue(null);
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.getTherapistRequest.mockResolvedValue(null);
  setHost({ ...createWebHost(), user: () => ({ id: '1', firstName: 'Аня' }) });
});
afterEach(() => {
  cleanup();
  setHost(null);
});

async function renderReady(
  props: Partial<Parameters<typeof SettingsSheet>[0]> = {},
) {
  const utils = render(<SettingsSheet onClose={() => {}} {...props} />);
  await screen.findByTestId('appearance-section');
  return utils;
}

describe('SettingsSheet — загрузка настроек', () => {
  it('до ответа api.getSettings показывает скелетон, а не пустой экран', () => {
    mockApi.getSettings.mockReturnValue(new Promise(() => {})); // висит вечно
    render(<SettingsSheet onClose={() => {}} />);
    expect(screen.queryByTestId('appearance-section')).toBeNull();
  });

  it('после загрузки запрашивает настройки, пару, статус терапии и заявку терапевта', async () => {
    await renderReady();
    expect(mockApi.getSettings).toHaveBeenCalled();
    expect(mockApi.getPair).toHaveBeenCalled();
    expect(mockApi.getTherapyRelation).toHaveBeenCalled();
    expect(mockApi.getTherapistRequest).toHaveBeenCalled();
  });
});

describe('SettingsSheet — ролевые секции', () => {
  it('роль CLIENT: видны секции клиента терапевта и «стать терапевтом», кабинет — нет', async () => {
    await renderReady({ userRole: 'CLIENT' });
    expect(screen.getByTestId('therapist-client-section')).toBeTruthy();
    expect(screen.getByTestId('become-therapist-section')).toBeTruthy();
    expect(screen.queryByTestId('therapist-cabinet-section')).toBeNull();
  });

  it('роль THERAPIST: виден кабинет, клиентские секции скрыты', async () => {
    await renderReady({ userRole: 'THERAPIST' });
    expect(screen.getByTestId('therapist-cabinet-section')).toBeTruthy();
    expect(screen.queryByTestId('therapist-client-section')).toBeNull();
    expect(screen.queryByTestId('become-therapist-section')).toBeNull();
  });
});

describe('SettingsSheet — «Назад»/«Закрыть» шапки', () => {
  it('в главном view клик по шеврону вызывает onClose', async () => {
    const onClose = vi.fn();
    await renderReady({ onClose });
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsSheet — оверлеи данных открываются из DataSection', () => {
  it('«Приватность» открывает PrivacyOverlay', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('data-open-privacy'));
    expect(screen.getByTestId('privacy-overlay')).toBeTruthy();
  });

  it('«Удалить аккаунт» открывает DeleteOverlay', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('data-open-delete'));
    expect(screen.getByTestId('delete-overlay')).toBeTruthy();
  });
});

describe('SettingsSheet — сохранение показывает тост «Сохранено ✓»', () => {
  it('до всякого сохранения тост невидим (opacity 0)', async () => {
    await renderReady();
    expect(screen.getByText('Сохранено ✓').style.opacity).toBe('0');
  });

  it('patch() вызывает api.updateSettings и делает тост видимым', async () => {
    mockApi.updateSettings.mockResolvedValue(undefined);
    await renderReady();
    fireEvent.click(screen.getByText('address-form-patch'));
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        addressForm: 'vy',
      }),
    );
    await waitFor(() =>
      expect(screen.getByText('Сохранено ✓').style.opacity).toBe('1'),
    );
  });
});

// Регрессия: patch() показывало «Сохранено ✓» независимо от результата
// api.updateSettings — отказ выглядел как успех (тост зелёный, глазами не
// отличить). Откат оптимистичного settings проверен отдельно на уровне хука
// (usePatchSettings.test.tsx, тумблер + aria-checked); здесь — что контейнер
// показывает видимую ошибку вместо «Сохранено ✓».
describe('SettingsSheet — сохранение: отказ виден, а не тишина', () => {
  it('отказ api.updateSettings показывает «Не сохранилось» вместо «Сохранено ✓»', async () => {
    mockApi.updateSettings.mockRejectedValue(new Error('network down'));
    await renderReady();
    fireEvent.click(screen.getByText('address-form-patch'));

    const status = await screen.findByText('Не сохранилось');
    expect(status.style.opacity).toBe('1');
    expect(screen.queryByText('Сохранено ✓')).toBeNull();
  });
});
