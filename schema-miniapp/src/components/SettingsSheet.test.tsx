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
  NotificationsSection: ({
    setView,
    onInfo,
  }: {
    setView: (v: 'time') => void;
    onInfo: () => void;
  }) => (
    <div data-testid="notifications-section">
      <button onClick={() => setView('time')}>notif-open-time</button>
      <button onClick={onInfo}>notif-info</button>
    </div>
  ),
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
  TherapistClientSection: ({
    therapyRelation,
    onInfo,
  }: {
    therapyRelation: unknown;
    onInfo: () => void;
  }) => (
    <div data-testid="therapist-client-section">
      <span>
        {therapyRelation === null
          ? 'терапевт: нет'
          : therapyRelation === undefined
            ? 'терапевт: загрузка'
            : 'терапевт: есть'}
      </span>
      <button onClick={onInfo}>therapist-client-info</button>
    </div>
  ),
}));
vi.mock('./settingsSheet/BecomeTherapistSection', () => ({
  BecomeTherapistSection: ({ therapistReq }: { therapistReq: unknown }) => (
    <div data-testid="become-therapist-section">
      {therapistReq === null
        ? 'заявка: нет'
        : therapistReq === undefined
          ? 'заявка: загрузка'
          : 'заявка: есть'}
    </div>
  ),
}));
vi.mock('./settingsSheet/TherapistCabinetSection', () => ({
  TherapistCabinetSection: () => (
    <div data-testid="therapist-cabinet-section" />
  ),
}));
vi.mock('./settingsSheet/PartnerSection', () => ({
  PartnerSection: ({
    pairLoading,
    handleLeave,
    handleCreateInvite,
    pairInviteUrl,
    pairInviteCopied,
    handleCopyPairInvite,
    joinCode,
    setJoinCode,
    joinError,
    handleJoin,
    onInfo,
  }: {
    pairLoading: boolean;
    handleLeave: (code: string) => void;
    handleCreateInvite: () => void;
    pairInviteUrl: string;
    pairInviteCopied: boolean;
    handleCopyPairInvite: () => void;
    joinCode: string;
    setJoinCode: (v: string) => void;
    joinError: boolean;
    handleJoin: () => void;
    onInfo: () => void;
  }) => (
    <div data-testid="partner-section">
      <span>{pairLoading ? 'пара: загрузка' : 'пара: готово'}</span>
      <span>{pairInviteUrl || 'ссылки нет'}</span>
      <span>{pairInviteCopied ? 'ссылка скопирована' : 'не скопировано'}</span>
      <span>{joinError ? 'код не подошёл' : 'без ошибки'}</span>
      <button onClick={handleCreateInvite}>partner-create-invite</button>
      <button onClick={handleCopyPairInvite}>partner-copy-invite</button>
      <input
        aria-label="join-code-input"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value)}
      />
      <button onClick={handleJoin}>partner-join</button>
      <button onClick={() => handleLeave('CODE1')}>partner-leave</button>
      <button onClick={onInfo}>partner-info</button>
    </div>
  ),
}));
vi.mock('./settingsSheet/AboutSection', () => ({
  AboutSection: () => <div data-testid="about-section" />,
}));
vi.mock('./settingsSheet/HomeScreenSection', () => ({
  HomeScreenSection: () => <div data-testid="home-screen-section" />,
}));
vi.mock('./settingsSheet/MiscSections', () => ({
  NameSection: () => <div data-testid="name-section" />,
  ShareSection: ({ setExportText }: { setExportText: (v: string) => void }) => (
    <div data-testid="share-section">
      <button onClick={() => setExportText('сводка для терапевта')}>
        share-open-export
      </button>
    </div>
  ),
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
  NotifyInfoOverlay: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="notify-info-overlay">
      <button onClick={onClose}>notify-info-close</button>
    </div>
  ),
  PairInfoOverlay: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="pair-info-overlay">
      <button onClick={onClose}>pair-info-close</button>
    </div>
  ),
  TherapistInfoOverlay: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="therapist-info-overlay">
      <button onClick={onClose}>therapist-info-close</button>
    </div>
  ),
}));
vi.mock('./settingsSheet/DataOverlays', () => ({
  ExportOverlay: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="export-overlay">
      <button onClick={onClose}>export-close</button>
    </div>
  ),
  PrivacyOverlay: ({
    onClose,
    onDeletedYsq,
  }: {
    onClose: () => void;
    onDeletedYsq: () => void;
  }) => (
    <div data-testid="privacy-overlay">
      <button onClick={onClose}>privacy-close</button>
      <button onClick={onDeletedYsq}>privacy-deleted-ysq</button>
    </div>
  ),
  DeleteOverlay: ({
    onBackdropClose,
    onCancel,
  }: {
    onBackdropClose: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="delete-overlay">
      <button onClick={onBackdropClose}>delete-backdrop-close</button>
      <button onClick={onCancel}>delete-cancel</button>
    </div>
  ),
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

// Четыре параллельные загрузки на монтировании (getPair/getTherapyRelation/
// getTherapistRequest) не должны ронять экран, если какая-то из них
// отказала — каждая падает в собственный видимый фолбэк, а не тишину.
describe('SettingsSheet — отказ параллельных загрузок виден в дочерних секциях', () => {
  it('getSettings отказал — контейнер всё равно поднимается с дефолтными настройками', async () => {
    mockApi.getSettings.mockRejectedValue(new Error('network down'));
    await renderReady();
    expect(screen.getByTestId('appearance-section')).toBeTruthy();
  });

  it('getPair отказал — «пара» перестаёт висеть в загрузке', async () => {
    mockApi.getPair.mockRejectedValue(new Error('network down'));
    await renderReady();
    await waitFor(() => expect(screen.getByText('пара: готово')).toBeTruthy());
  });

  it('getTherapyRelation отказал — секция клиента терапевта показывает «нет», а не вечную загрузку', async () => {
    mockApi.getTherapyRelation.mockRejectedValue(new Error('network down'));
    await renderReady({ userRole: 'CLIENT' });
    await waitFor(() => expect(screen.getByText('терапевт: нет')).toBeTruthy());
  });

  it('getTherapistRequest отказал — секция «стать терапевтом» показывает «нет заявки»', async () => {
    mockApi.getTherapistRequest.mockRejectedValue(new Error('network down'));
    await renderReady({ userRole: 'CLIENT' });
    await waitFor(() => expect(screen.getByText('заявка: нет')).toBeTruthy());
  });
});

describe('SettingsSheet — клавиатурная активация шапки (Enter/Space)', () => {
  it('Enter в главном view вызывает onClose, как и клик', async () => {
    const onClose = vi.fn();
    await renderReady({ onClose });
    fireEvent.keyDown(screen.getByLabelText('Закрыть'), { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('пробел в подэкране («Время уведомления») возвращает в главный view, не вызывая onClose', async () => {
    const onClose = vi.fn();
    await renderReady({ onClose });
    fireEvent.click(screen.getByText('notif-open-time'));
    const back = await screen.findByLabelText('Назад');
    expect(screen.getByText('Время уведомления')).toBeTruthy();

    fireEvent.keyDown(back, { key: ' ' });
    expect(screen.getByText('Настройки')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('SettingsSheet — приглашение партнёра (handleCreateInvite)', () => {
  it('успех создаёт ссылку-приглашение и показывает её в секции партнёра', async () => {
    mockApi.createPairInvite.mockResolvedValue({
      url: 'https://t.me/schema_happens_bot?start=INV1',
    });
    mockApi.getPair.mockResolvedValue(null);
    Object.assign(navigator, { share: vi.fn().mockResolvedValue(undefined) });
    await renderReady();

    fireEvent.click(screen.getByText('partner-create-invite'));
    await waitFor(() =>
      expect(
        screen.getByText('https://t.me/schema_happens_bot?start=INV1'),
      ).toBeTruthy(),
    );
    await waitFor(() => expect(screen.getByText('пара: готово')).toBeTruthy());
  });
});

describe('SettingsSheet — копирование ссылки-приглашения (handleCopyPairInvite)', () => {
  it('успешное копирование показывает «ссылка скопирована»', async () => {
    mockApi.createPairInvite.mockResolvedValue({
      url: 'https://t.me/schema_happens_bot?start=INV1',
    });
    mockApi.getPair.mockResolvedValue(null);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await renderReady();

    fireEvent.click(screen.getByText('partner-create-invite'));
    await screen.findByText('https://t.me/schema_happens_bot?start=INV1');
    fireEvent.click(screen.getByText('partner-copy-invite'));
    await waitFor(() =>
      expect(screen.getByText('ссылка скопирована')).toBeTruthy(),
    );
  });
});

describe('SettingsSheet — вступление по коду (handleJoin)', () => {
  it('успех: код уходит в верхнем регистре, пара обновляется', async () => {
    mockApi.joinPair.mockResolvedValue(undefined);
    await renderReady();

    fireEvent.change(screen.getByLabelText('join-code-input'), {
      target: { value: 'ab12' },
    });
    fireEvent.click(screen.getByText('partner-join'));
    await waitFor(() => expect(mockApi.joinPair).toHaveBeenCalledWith('AB12'));
    await waitFor(() => expect(screen.getByText('без ошибки')).toBeTruthy());
  });

  it('отказ показывает «код не подошёл», а не тишину', async () => {
    mockApi.joinPair.mockRejectedValue(new Error('not found'));
    await renderReady();

    fireEvent.change(screen.getByLabelText('join-code-input'), {
      target: { value: 'zz99' },
    });
    fireEvent.click(screen.getByText('partner-join'));
    await waitFor(() =>
      expect(screen.getByText('код не подошёл')).toBeTruthy(),
    );
  });

  it('пустой код не уходит в api.joinPair', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('partner-join'));
    expect(mockApi.joinPair).not.toHaveBeenCalled();
  });
});

describe('SettingsSheet — выход из пары (handleLeave)', () => {
  it('отказ leavePair и последующего обновления пары не роняет экран', async () => {
    mockApi.leavePair.mockRejectedValue(new Error('network down'));
    mockApi.getPair
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('network down'));
    await renderReady();

    fireEvent.click(screen.getByText('partner-leave'));
    await waitFor(() =>
      expect(mockApi.leavePair).toHaveBeenCalledWith('CODE1'),
    );
    // Экран остаётся живым — секция партнёра всё ещё на месте.
    expect(screen.getByTestId('partner-section')).toBeTruthy();
  });
});

describe('SettingsSheet — инфо-оверлеи открываются из секций и закрываются', () => {
  it('«Уведомления»: onInfo открывает NotifyInfoOverlay, кнопка закрывает', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('notif-info'));
    expect(screen.getByTestId('notify-info-overlay')).toBeTruthy();
    fireEvent.click(screen.getByText('notify-info-close'));
    expect(screen.queryByTestId('notify-info-overlay')).toBeNull();
  });

  it('«Мой терапевт»: onInfo открывает TherapistInfoOverlay, кнопка закрывает', async () => {
    await renderReady({ userRole: 'CLIENT' });
    fireEvent.click(screen.getByText('therapist-client-info'));
    expect(screen.getByTestId('therapist-info-overlay')).toBeTruthy();
    fireEvent.click(screen.getByText('therapist-info-close'));
    expect(screen.queryByTestId('therapist-info-overlay')).toBeNull();
  });

  it('«Партнёр»: onInfo открывает PairInfoOverlay, кнопка закрывает', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('partner-info'));
    expect(screen.getByTestId('pair-info-overlay')).toBeTruthy();
    fireEvent.click(screen.getByText('pair-info-close'));
    expect(screen.queryByTestId('pair-info-overlay')).toBeNull();
  });
});

describe('SettingsSheet — оверлей экспорта закрывается и сбрасывает копирование', () => {
  it('«Поделиться» открывает ExportOverlay, кнопка закрывает', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('share-open-export'));
    expect(screen.getByTestId('export-overlay')).toBeTruthy();
    fireEvent.click(screen.getByText('export-close'));
    expect(screen.queryByTestId('export-overlay')).toBeNull();
  });
});

describe('SettingsSheet — оверлей приватности: оба закрывающих действия', () => {
  it('«Приватность» → «Закрыть» прячет оверлей', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('data-open-privacy'));
    fireEvent.click(screen.getByText('privacy-close'));
    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
  });

  it('«Приватность» → удаление YSQ тоже прячет оверлей', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('data-open-privacy'));
    fireEvent.click(screen.getByText('privacy-deleted-ysq'));
    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
  });
});

describe('SettingsSheet — оверлей удаления аккаунта: оба закрывающих действия', () => {
  it('«Удалить аккаунт» → закрытие по бэкдропу прячет оверлей', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('data-open-delete'));
    fireEvent.click(screen.getByText('delete-backdrop-close'));
    expect(screen.queryByTestId('delete-overlay')).toBeNull();
  });

  it('«Удалить аккаунт» → «Отмена» тоже прячет оверлей', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('data-open-delete'));
    fireEvent.click(screen.getByText('delete-cancel'));
    expect(screen.queryByTestId('delete-overlay')).toBeNull();
  });
});
