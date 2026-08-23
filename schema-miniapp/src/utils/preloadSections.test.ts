// @vitest-environment jsdom
// preloadOtherSections — фоновая догрузка секций, которые пользователь не
// открыл первыми (см. комментарий в preloadSections.ts, замер 2026-08-22).
// Проверяем: текущая секция не грузится повторно, остальные три грузятся по
// одной за виток простоя (не одним Promise.all), и есть рабочий фолбэк на
// setTimeout, когда requestIdleCallback в хосте недоступен (Telegram/MAX
// WebView, Safari).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock хоистится над обычными const — фабрика не может замкнуться на
// переменную, объявленную ниже в исходнике (ReferenceError на «до
// инициализации»). vi.hoisted поднимает саму переменную вместе с моком.
const { loaders } = vi.hoisted(() => ({
  loaders: {
    today: vi.fn(() => Promise.resolve({})),
    schemas: vi.fn(() => Promise.resolve({})),
    help: vi.fn(() => Promise.resolve({})),
    profile: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('./sectionLoaders', () => ({ SECTION_LOADERS: loaders }));

// Импорт ПОСЛЕ vi.mock — hoisting поднимет мок выше, но синтаксически так
// нагляднее (тот же приём, что в App.test-helpers.tsx).
import { preloadOtherSections } from './preloadSections';

// requestIdleCallback объявлен в типах DOM как гарантированный метод Window,
// хотя в WebView Telegram/MAX и Safari его в рантайме может не быть — отсюда
// Reflect.deleteProperty вместо `delete window.requestIdleCallback` (обычный
// delete требует опциональности свойства по типу, а здесь оно неопционально).
function deleteRic(): void {
  Reflect.deleteProperty(window, 'requestIdleCallback');
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteRic();
});

afterEach(() => {
  deleteRic();
  vi.useRealTimers();
});

describe('preloadOtherSections — без requestIdleCallback (фолбэк setTimeout)', () => {
  it('планирует все секции кроме текущей и не трогает текущую', () => {
    vi.useFakeTimers();
    const rest = preloadOtherSections('today');
    expect(rest).toEqual(['schemas', 'help', 'profile']);
    expect(loaders.today).not.toHaveBeenCalled();
  });

  it('грузит запланированные секции по одной за виток таймера, не разом', async () => {
    vi.useFakeTimers();
    preloadOtherSections('today');
    expect(loaders.schemas).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(loaders.schemas).toHaveBeenCalledTimes(1);
    expect(loaders.help).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(loaders.help).toHaveBeenCalledTimes(1);
    expect(loaders.profile).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(loaders.profile).toHaveBeenCalledTimes(1);
  });
});

describe('preloadOtherSections — requestIdleCallback доступен', () => {
  it('использует requestIdleCallback вместо setTimeout, когда хост его даёт', async () => {
    const ric = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    window.requestIdleCallback = ric;

    preloadOtherSections('profile');
    // Каждый виток резолвится микротасками (Promise .then/.finally) —
    // достаточно прогнать несколько раз, чтобы цепочка из 3 загрузок дошла
    // до конца без реальных таймеров.
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(ric).toHaveBeenCalledTimes(3);
    expect(loaders.today).toHaveBeenCalledTimes(1);
    expect(loaders.schemas).toHaveBeenCalledTimes(1);
    expect(loaders.help).toHaveBeenCalledTimes(1);
    expect(loaders.profile).not.toHaveBeenCalled();
  });
});
