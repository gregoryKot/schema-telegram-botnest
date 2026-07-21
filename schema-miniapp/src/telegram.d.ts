declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          start_param?: string;
          user?: { id: number; first_name: string; username?: string };
        };
        contentSafeAreaInset?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
        safeAreaInset?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
        // Bot API 8.0: приложение открыто в полноэкранном режиме (сверху висят
        // плавающие кнопки Telegram) — влияет на верхний отступ шапки.
        isFullscreen?: boolean;
        onEvent?(event: string, cb: () => void): void;
        offEvent?(event: string, cb: () => void): void;
        platform?: string;
        version?: string;
        showAlert?(message: string, callback?: () => void): void;
        addToHomeScreen?(): void;
        // Bot API 8.0: статус значка приходит колбэком — не надо спрашивать
        // пользователя «ты добавил?».
        checkHomeScreenStatus?(
          cb: (status: 'unsupported' | 'unknown' | 'added' | 'missed') => void,
        ): void;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        ready(): void;
        expand(): void;
        close(): void;
        disableVerticalSwipes(): void;
        openLink(url: string, options?: { try_instant_view?: boolean }): void;
        BackButton: {
          isVisible: boolean;
          show(): void;
          hide(): void;
          onClick(fn: () => void): void;
          offClick(fn: () => void): void;
        };
        MainButton: {
          text: string;
          isVisible: boolean;
          isActive: boolean;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          onClick(fn: () => void): void;
          offClick(fn: () => void): void;
          showProgress(leaveActive: boolean): void;
          hideProgress(): void;
        };
        HapticFeedback: {
          impactOccurred(
            style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
          ): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
      };
    };
  }
}

export {};
