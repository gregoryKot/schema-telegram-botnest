// Адрес кабинета / BOT_USERNAME (аудит 2026-10, infra#18): раньше пустая
// переменная молча вела webApp-кнопки на старый vercel-деплой, а ссылки
// приглашений — в бота «SchemaLabBot». Константы вычисляются при загрузке
// модуля, поэтому каждый кейс грузит их заново с заданным env.
type Constants = typeof import('./telegram.constants');
type Link = typeof import('./miniapp-link');

const KEYS = ['APP_URL', 'BOT_USERNAME', 'MINIAPP_APP_NAME'];

function load(env: Record<string, string | undefined> = {}): {
  constants: Constants;
  link: Link;
} {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  KEYS.forEach((k) => delete process.env[k]);
  Object.entries(env).forEach(([k, v]) => {
    if (v !== undefined) process.env[k] = v;
  });
  try {
    let loaded!: { constants: Constants; link: Link };
    jest.isolateModules(() => {
      loaded = {
        constants: jest.requireActual<Constants>('./telegram.constants'),
        link: jest.requireActual<Link>('./miniapp-link'),
      };
    });
    return loaded;
  } finally {
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  }
}

describe('CABINET_URL', () => {
  it('без env — кабинет канонического хоста: /today', () => {
    expect(load().constants.CABINET_URL).toBe('https://schemehappens.ru/today');
    expect(load().constants.CABINET_HELP_URL).toBe(
      'https://schemehappens.ru/practice',
    );
  });

  it('выводится из APP_URL, а не зашит: staging получает свой хост', () => {
    expect(load({ APP_URL: 'staging.example' }).constants.CABINET_URL).toBe(
      'https://staging.example/today',
    );
  });
});

describe('BOT_USERNAME', () => {
  it('ни одно экспортированное значение не ведёт на vercel или старого бота', () => {
    // Строитель ссылки (cabinetTasksUrl) проверяется тем, что строит.
    const values = Object.values(load().constants).map((v) =>
      typeof v === 'function'
        ? String((v as () => unknown)())
        : JSON.stringify(v),
    );
    for (const v of values) {
      expect(v).not.toMatch(/vercel/i);
      expect(v).not.toContain('SchemaLabBot');
    }
  });

  it('без env имя пустое, а не дефолтное', () => {
    expect(load().constants.BOT_USERNAME).toBe('');
  });

  it('@ в начале и пробелы срезаются', () => {
    expect(
      load({ BOT_USERNAME: ' @SchemeHappensBot ' }).constants.BOT_USERNAME,
    ).toBe('SchemeHappensBot');
  });
});

describe('miniappStartLink', () => {
  it('с именем бота строит t.me-ссылку со startapp', () => {
    const { link } = load({ BOT_USERNAME: 'SchemeHappensBot' });
    expect(link.miniappStartLink('pair_X')).toBe(
      'https://t.me/SchemeHappensBot/diary?startapp=pair_X',
    );
  });

  it('без имени бота бросает 503 и не строит t.me//diary', () => {
    const { link } = load();
    // Класс исключения из изолированного реестра модулей не совпадает с
    // импортированным здесь — сверяем статус, а не конструктор.
    let status: number | undefined;
    try {
      link.miniappStartLink('pair_X');
    } catch (e) {
      status = (e as { getStatus(): number }).getStatus();
    }
    expect(status).toBe(503);
  });

  it('текст ошибки безличный: без «ты/вы» и без имени переменной для клиента', () => {
    const { link } = load();
    try {
      link.miniappStartLink('pair_X');
      throw new Error('должно было бросить');
    } catch (e) {
      expect((e as Error).message).toBe(
        'Ссылки-приглашения временно недоступны',
      );
    }
  });
});

// Аудит 2026-11, U3: приглашение терапевта ведёт на сайт, Telegram — вторая
// строка. Без бота приглашение не должно падать 503 целиком.
describe('optionalMiniappStartLink', () => {
  it('с именем бота — та же t.me-ссылка', () => {
    const { link } = load({ BOT_USERNAME: 'SchemeHappensBot' });
    expect(link.optionalMiniappStartLink('therapy_X')).toBe(
      'https://t.me/SchemeHappensBot/diary?startapp=therapy_X',
    );
  });

  it('без имени бота — null, а не исключение', () => {
    expect(load().link.optionalMiniappStartLink('therapy_X')).toBeNull();
  });
});

// Аудит 2026-11, U2: кнопки уведомлений о задании и тесте открывали «Сегодня».
describe('ссылки запуска кабинета', () => {
  it('тест и задания — с параметром запуска на адресе кабинета', () => {
    const { constants } = load();
    expect(constants.CABINET_YSQ_URL).toBe(
      'https://schemehappens.ru/today?startapp=ysq',
    );
    expect(constants.cabinetTasksUrl()).toBe(
      'https://schemehappens.ru/today?startapp=tasks',
    );
    expect(constants.cabinetTasksUrl(7)).toBe(
      'https://schemehappens.ru/today?startapp=tasks_7',
    );
  });
});
