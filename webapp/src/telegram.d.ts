// window.Telegram присутствует только когда сайт открыт во встроенном браузере
// Telegram (редкий путь: логин по initData). Минимальный тип того, что реально
// читаем, вместо `(window as any).Telegram`.
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { user?: { id: number; first_name?: string } };
      };
    };
  }
}

export {};
