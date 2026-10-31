import { Logger } from '@nestjs/common';
import { StatsReportService } from './stats-report.service';
import { BLOCK_FAILED_MARK } from './stats-settle';
import { selfCheckState } from '../infra/self-check/state';

describe('StatsReportService.render', () => {
  const build = () => {
    const product = {
      render: jest.fn().mockResolvedValue('продуктовые метрики'),
    };
    const modeCard = {
      render: jest.fn().mockResolvedValue('карточки режимов: 9'),
    };
    const modeDiary = {
      render: jest.fn().mockResolvedValue('дневник режимов: 5'),
    };
    const warmWords = {
      render: jest.fn().mockResolvedValue('тёплые слова: 3'),
    };
    const phraseChecks = {
      render: jest.fn().mockResolvedValue('разборы фраз: 7'),
    };
    const entryDelete = {
      render: jest.fn().mockResolvedValue('удаление записей: 2'),
    };
    const accountLink = {
      render: jest.fn().mockResolvedValue('перенос данных: 2'),
    };
    const plus = {
      render: jest.fn().mockResolvedValue('кнопка плюс: 4'),
    };
    const webBanner = {
      render: jest.fn().mockResolvedValue('баннеры-переходы: 6'),
    };
    const siteInstall = {
      render: jest.fn().mockResolvedValue('установка с сайта: 8'),
    };
    const screen = {
      render: jest.fn().mockResolvedValue('настройка экранов: 1'),
    };
    const profilePattern = {
      render: jest.fn().mockResolvedValue('паттерны со вкладки «Я»: 4'),
    };
    const conceptGraph = {
      render: jest.fn().mockResolvedValue('схема случая по режимам: 3'),
    };
    const authHealth = {
      render: jest.fn().mockResolvedValue('вход в мессенджере: всё хорошо'),
    };
    const loginTicket = {
      render: jest.fn().mockResolvedValue('вход по коду: 74 из 74'),
    };
    const clientErrors = {
      render: jest.fn().mockResolvedValue('поломки на клиенте: не было'),
    };
    const money = {
      render: jest.fn().mockResolvedValue('деньги: поддержали 3 раза'),
    };
    const sessionCurrency = {
      render: jest.fn().mockResolvedValue('сессии не в рублях: 2'),
    };
    const signupSource = {
      render: jest.fn().mockResolvedValue('новенькие по ссылкам: 5'),
    };
    const game = {
      render: jest.fn().mockResolvedValue('игра: открыли 12'),
    };
    const dataExport = {
      render: jest.fn().mockResolvedValue('забирают свои данные: 7'),
    };
    const bookingRetention = {
      render: jest.fn().mockResolvedValue('данные записей: стёрто 5'),
    };
    const introLeads = {
      render: jest.fn().mockResolvedValue('заявки со знакомства: 3'),
    };
    const therapyNudge = {
      render: jest.fn().mockResolvedValue('мост к терапевту: пока ничего'),
    };
    const notifyQueue = {
      render: jest.fn().mockResolvedValue('напоминания из бота: ушло 9'),
    };
    const therapistExit = {
      render: jest.fn().mockResolvedValue('терапевты уходят: 2'),
    };
    return {
      blocks: {
        entryDelete,
        accountLink,
        plus,
        webBanner,
        siteInstall,
        screen,
        profilePattern,
        conceptGraph,
        authHealth,
        loginTicket,
        clientErrors,
        money,
        sessionCurrency,
        signupSource,
        game,
        dataExport,
        bookingRetention,
        introLeads,
        therapyNudge,
        notifyQueue,
        therapistExit,
      },
      service: new StatsReportService(
        product as never,
        modeCard as never,
        modeDiary as never,
        warmWords as never,
        phraseChecks as never,
        entryDelete as never,
        accountLink as never,
        plus as never,
        webBanner as never,
        siteInstall as never,
        screen as never,
        profilePattern as never,
        conceptGraph as never,
        authHealth as never,
        loginTicket as never,
        clientErrors as never,
        money as never,
        sessionCurrency as never,
        signupSource as never,
        game as never,
        dataExport as never,
        bookingRetention as never,
        introLeads as never,
        therapyNudge as never,
        notifyQueue as never,
        therapistExit as never,
      ),
    };
  };

  it('склеивает все блоки отчёта в одном порядке', async () => {
    const { service } = build();

    const out = await service.render();
    expect(
      out.startsWith('продуктовые метрики\n\nкарточки режимов: 9\n\n'),
    ).toBe(true);
    expect(out).toContain(
      'разборы фраз: 7\n\nудаление записей: 2\n\nперенос данных: 2',
    );
    expect(out).toContain(
      'кнопка плюс: 4\n\nбаннеры-переходы: 6\n\nустановка с сайта: 8\n\nнастройка экранов: 1',
    );
    expect(out).toContain(
      'настройка экранов: 1\n\nпаттерны со вкладки «Я»: 4\n\nсхема случая по режимам: 3\n\nвход в мессенджере: всё хорошо',
    );
    expect(out).toContain(
      'вход в мессенджере: всё хорошо\n\nвход по коду: 74 из 74\n\nполомки на клиенте: не было\n\nнапоминания из бота: ушло 9\n\nденьги: поддержали 3 раза\n\nсессии не в рублях: 2\n\nновенькие по ссылкам: 5\n\nигра: открыли 12\n\nзабирают свои данные: 7\n\nданные записей: стёрто 5\n\nзаявки со знакомства: 3\n\nмост к терапевту: пока ничего\n\nтерапевты уходят: 2',
    );
    // Хвост — блоки о здоровье системы (считаются из process.env и состояния
    // самопроверки, не мокаются через blocks): порядок календарь → Настройки →
    // Переменные → Самопроверка, и ничего после них.
    const settings = out.indexOf('⚙️ <b>Настройки</b>');
    const env = out.indexOf('Настройки: переменные</b>');
    const selfCheck = out.indexOf('🩺 <b>Самопроверка</b>');
    expect(settings).toBeGreaterThan(out.indexOf('терапевты уходят: 2'));
    expect(env).toBeGreaterThan(settings);
    expect(selfCheck).toBeGreaterThan(env);
    expect(out.indexOf('🩺', selfCheck + 1)).toBe(-1);
  });

  describe('один блок упал — отчёт не гаснет', () => {
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });
    afterEach(() => jest.restoreAllMocks());

    it('render() бросает: остальные блоки, Настройки, Переменные и Самопроверка на месте', async () => {
      const { service, blocks } = build();
      blocks.money.render.mockRejectedValue(
        new Error('pool <timeout>\nstack: at x'),
      );
      const out = await service.render();
      // Заглушка стоит на месте блока: между соседями, в прежнем порядке.
      expect(out).toContain(
        `вход в мессенджере: всё хорошо\n\nвход по коду: 74 из 74\n\nполомки на клиенте: не было\n\nнапоминания из бота: ушло 9\n\n⚠️ <b>«Деньги»</b>: ${BLOCK_FAILED_MARK} — pool &lt;timeout&gt;\n\nсессии не в рублях: 2\n\nновенькие по ссылкам: 5`,
      );
      expect(out).not.toContain('stack: at x');
      expect(out).toContain('продуктовые метрики');
      expect(out).toContain('данные записей: стёрто 5');
      expect(out).toContain('⚙️ <b>Настройки</b>');
      expect(out).toContain('Настройки: переменные</b>');
      expect(out).toContain('🩺 <b>Самопроверка</b>');
      // warn, не error: error ушёл бы админу в DM на каждый его же /stats.
      expect(warn).toHaveBeenCalledWith(
        'stats block "Деньги" failed: pool <timeout>',
      );
      expect(error).not.toHaveBeenCalled();
    });

    it('упали все блоки метрик: инфраструктурный хвост всё равно приезжает', async () => {
      const { service, blocks } = build();
      for (const b of Object.values(blocks)) {
        b.render.mockRejectedValue(new Error('db down'));
      }
      const out = await service.render();
      expect(out).toContain(BLOCK_FAILED_MARK);
      expect(out).toContain('🩺 <b>Самопроверка</b>');
      expect(out).toContain('⚙️ <b>Настройки</b>');
    });

    it('инфраструктурный блок бросает синхронно: продуктовые блоки и соседние не страдают', async () => {
      jest.spyOn(selfCheckState, 'get').mockImplementation(() => {
        throw new Error('state broken');
      });
      const { service } = build();
      const out = await service.render();
      expect(out).toContain('данные записей: стёрто 5');
      expect(out).toContain('⚙️ <b>Настройки</b>');
      expect(out).toContain(`«Самопроверка»</b>: ${BLOCK_FAILED_MARK}`);
      expect(out).toContain('state broken');
    });

    it('отклонение не-Error значением не даёт «undefined» и «[object Object]»', async () => {
      const { service, blocks } = build();
      blocks.game.render.mockRejectedValue(undefined);
      blocks.money.render.mockRejectedValue('строкой');
      const out = await service.render();
      expect(out).toContain(`«Игра»</b>: ${BLOCK_FAILED_MARK}\n`);
      expect(out).toContain('— строкой');
      expect(out).not.toMatch(/undefined|\[object Object\]/);
    });
  });

  it('новый блок реально спрашивается — событие без строки в отчёте невидимо', async () => {
    // Правило №8: подключить сервис в модуль и забыть вызвать его здесь —
    // ровно тот случай, когда метрика «есть», а в /stats её нет.
    const { service, blocks } = build();
    const out = await service.render();
    expect(blocks.entryDelete.render).toHaveBeenCalledTimes(1);
    expect(blocks.accountLink.render).toHaveBeenCalledTimes(1);
    expect(blocks.plus.render).toHaveBeenCalledTimes(1);
    expect(blocks.webBanner.render).toHaveBeenCalledTimes(1);
    expect(blocks.siteInstall.render).toHaveBeenCalledTimes(1);
    expect(blocks.screen.render).toHaveBeenCalledTimes(1);
    expect(blocks.profilePattern.render).toHaveBeenCalledTimes(1);
    expect(blocks.conceptGraph.render).toHaveBeenCalledTimes(1);
    expect(blocks.authHealth.render).toHaveBeenCalledTimes(1);
    expect(blocks.loginTicket.render).toHaveBeenCalledTimes(1);
    expect(blocks.clientErrors.render).toHaveBeenCalledTimes(1);
    expect(blocks.money.render).toHaveBeenCalledTimes(1);
    expect(blocks.signupSource.render).toHaveBeenCalledTimes(1);
    expect(blocks.game.render).toHaveBeenCalledTimes(1);
    expect(blocks.dataExport.render).toHaveBeenCalledTimes(1);
    expect(blocks.bookingRetention.render).toHaveBeenCalledTimes(1);
    expect(blocks.introLeads.render).toHaveBeenCalledTimes(1);
    expect(blocks.therapyNudge.render).toHaveBeenCalledTimes(1);
    expect(blocks.notifyQueue.render).toHaveBeenCalledTimes(1);
    expect(blocks.therapistExit.render).toHaveBeenCalledTimes(1);
    expect(out).toContain('удаление записей: 2');
    expect(out).toContain('перенос данных: 2');
    expect(out).toContain('кнопка плюс: 4');
    expect(out).toContain('баннеры-переходы: 6');
    expect(out).toContain('установка с сайта: 8');
    expect(out).toContain('настройка экранов: 1');
    expect(out).toContain('паттерны со вкладки «Я»: 4');
    expect(out).toContain('схема случая по режимам: 3');
    expect(out).toContain('вход в мессенджере: всё хорошо');
    expect(out).toContain('вход по коду: 74 из 74');
    expect(out).toContain('поломки на клиенте: не было');
    expect(out).toContain('деньги: поддержали 3 раза');
    expect(out).toContain('новенькие по ссылкам: 5');
    expect(out).toContain('игра: открыли 12');
    expect(out).toContain('забирают свои данные: 7');
    expect(out).toContain('данные записей: стёрто 5');
    expect(out).toContain('заявки со знакомства: 3');
    expect(out).toContain('напоминания из бота: ушло 9');
    expect(out).toContain('терапевты уходят: 2');
  });

  it('упавший запрос заявок числится под своим именем и не гасит «Данные записей» (settleBlocks)', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, blocks } = build();
    blocks.introLeads.render.mockRejectedValue(new Error('db down'));
    const out = await service.render();
    expect(out).toContain('данные записей: стёрто 5');
    expect(out).toContain('«Заявки с формы знакомства»');
    expect(out).not.toContain('заявки со знакомства: 3');
    jest.restoreAllMocks();
  });
});
