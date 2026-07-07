declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          start_param?: string;
          user?: { id: number; first_name: string; username?: string };
        };
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
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
      };
    };
  }
}

export {};
