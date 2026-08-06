// Хост — то, внутри чего открыто приложение: Telegram, MAX или обычный
// браузер. Ядро приложения не знает, где оно живёт, и спрашивает хост через
// этот интерфейс. Новая площадка = новый адаптер, а не правки по всему коду.
//
// Принцип: возможности хоста опциональны. Нет вибрации — `haptic.tap()` тихо
// ничего не делает; нет кнопки «назад» — падаем на историю браузера. Хост,
// который чего-то не умеет, деградирует, а не роняет экран.

export type HostId = 'telegram' | 'max' | 'web';

export type HomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed';

export interface HostUser {
  /** Строкой: у Telegram число, у остальных площадок формат свой. */
  id: string;
  firstName?: string;
  username?: string;
}

export interface HostCapabilities {
  /** Тактильный отклик — Telegram HapticFeedback или navigator.vibrate. */
  haptics: boolean;
  /** Хост даёт свою кнопку «назад» (иначе — история браузера). */
  backButton: boolean;
  /** Хост умеет сам поставить значок на домашний экран. */
  homeScreen: boolean;
  /** Приложение можно закрыть изнутри (в браузере вкладку не закрыть). */
  close: boolean;
}

/** Сырые сигналы безопасной зоны. Что из них считать отступом — дело экрана. */
export interface HostInsets {
  contentTop?: number;
  deviceTop?: number;
  isFullscreen: boolean;
  /** Хост хоть раз прислал contentTop: значение 0 тоже считается ответом. */
  contentReported: boolean;
  /**
   * Хост рисует свои кнопки (закрыть/меню) ПОВЕРХ контента. У таких хостов
   * нулевой верхний инсет — это «значение не доехало», а не «отступ не нужен»:
   * поверить ему значит увести шапку под кнопки мессенджера.
   */
  overlaysContent: boolean;
}

export interface HostHaptic {
  tap(): void;
  /** Долгое нажатие — отклик заметнее обычного тапа. */
  press(): void;
  select(): void;
  success(): void;
  warning(): void;
  error(): void;
}

export interface HostBackButton {
  setVisible(visible: boolean): void;
  /** Возвращает отписку. */
  onClick(cb: () => void): () => void;
}

export interface HostHomeScreen {
  add(): void;
  checkStatus(cb: (status: HomeScreenStatus) => void): void;
  /** Возвращает отписку. */
  onAdded(cb: () => void): () => void;
}

export interface HostBridge {
  readonly id: HostId;
  /** Как хост назвал устройство: 'ios' | 'android' | 'tdesktop' | 'web' | … */
  readonly platform: string | undefined;
  readonly capabilities: HostCapabilities;

  ready(): void;
  expand(): void;
  close(): void;

  user(): HostUser | null;
  /** Параметр глубокой ссылки (Telegram start_param). */
  startParam(): string | null;
  /**
   * Заголовки первичного входа: подписанная хостом строка, которую бэкенд
   * меняет на пару access/refresh. В браузере пусто — там вход по JWT.
   */
  authHeaders(): Record<string, string>;
  /**
   * Куда и с чем сходить, чтобы обменять подпись хоста на сессию. У каждого
   * мессенджера свой эндпоинт; null — обменивать нечего (браузер, протухшая
   * подпись), тогда сессию тянет только refresh-кука.
   */
  sessionExchange(): { path: string; body: Record<string, unknown> } | null;

  /** Тема хоста; null — хост своей темы не навязывает, решает система. */
  colorScheme(): 'light' | 'dark' | null;
  insets(): HostInsets;
  /** Возвращает отписку. */
  onInsetsChange(cb: () => void): () => void;

  openLink(url: string): void;
  /**
   * Отдать пользователю файл (например .ics с напоминанием о практике).
   * В мессенджере это открытие ссылки, чтобы файл подхватила система;
   * в браузере — обычная ссылка на скачивание.
   */
  saveFile(dataUrl: string, filename: string): void;

  readonly haptic: HostHaptic;
  readonly backButton: HostBackButton;
  readonly homeScreen: HostHomeScreen;
}
