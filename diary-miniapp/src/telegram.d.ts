declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: { id: number; first_name: string; username?: string };
        };
        ready(): void;
        expand(): void;
        close(): void;
      };
    };
  }
}

export {};
