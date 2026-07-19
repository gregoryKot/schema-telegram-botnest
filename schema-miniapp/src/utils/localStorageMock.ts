// Общий мок localStorage для vitest-тестов без jsdom (outbox, webBanner, …).
// Единственная копия — не дублируй в тестах (jscpd-храповик это ловит).
export function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: () => null,
  };
}
