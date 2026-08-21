import { StatsReportService } from './stats-report.service';

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
    const authHealth = {
      render: jest.fn().mockResolvedValue('вход в мессенджере: всё хорошо'),
    };
    const clientErrors = {
      render: jest.fn().mockResolvedValue('поломки на клиенте: не было'),
    };
    const money = {
      render: jest.fn().mockResolvedValue('деньги: поддержали 3 раза'),
    };
    const signupSource = {
      render: jest.fn().mockResolvedValue('новенькие по ссылкам: 5'),
    };
    return {
      blocks: {
        accountLink,
        plus,
        webBanner,
        siteInstall,
        screen,
        profilePattern,
        authHealth,
        clientErrors,
        money,
        signupSource,
      },
      service: new StatsReportService(
        product as never,
        modeCard as never,
        modeDiary as never,
        warmWords as never,
        phraseChecks as never,
        accountLink as never,
        plus as never,
        webBanner as never,
        siteInstall as never,
        screen as never,
        profilePattern as never,
        authHealth as never,
        clientErrors as never,
        money as never,
        signupSource as never,
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
      'кнопка плюс: 4\n\nбаннеры-переходы: 6\n\nустановка с сайта: 8\n\nнастройка экранов: 1',
    );
    expect(out).toContain(
      'настройка экранов: 1\n\nпаттерны со вкладки «Я»: 4\n\nвход в мессенджере: всё хорошо',
    );
    expect(out).toContain(
      'вход в мессенджере: всё хорошо\n\nполомки на клиенте: не было\n\nденьги: поддержали 3 раза\n\nновенькие по ссылкам: 5',
    );
    // Блок «Настройки» (щит, волна 8) — считается из process.env напрямую
    // (не мокается через blocks), но обязан приезжать последним куском
    // отчёта, сразу после блока «Деньги».
    const capabilityIndex = out.indexOf('⚙️ <b>Настройки</b>');
    expect(capabilityIndex).toBeGreaterThan(-1);
    expect(out.slice(capabilityIndex)).toBe(
      out.trimEnd().slice(capabilityIndex),
    );
  });

  it('новый блок реально спрашивается — событие без строки в отчёте невидимо', async () => {
    // Правило №8: подключить сервис в модуль и забыть вызвать его здесь —
    // ровно тот случай, когда метрика «есть», а в /stats её нет.
    const { service, blocks } = build();
    const out = await service.render();
    expect(blocks.accountLink.render).toHaveBeenCalledTimes(1);
    expect(blocks.plus.render).toHaveBeenCalledTimes(1);
    expect(blocks.webBanner.render).toHaveBeenCalledTimes(1);
    expect(blocks.siteInstall.render).toHaveBeenCalledTimes(1);
    expect(blocks.screen.render).toHaveBeenCalledTimes(1);
    expect(blocks.profilePattern.render).toHaveBeenCalledTimes(1);
    expect(blocks.authHealth.render).toHaveBeenCalledTimes(1);
    expect(blocks.clientErrors.render).toHaveBeenCalledTimes(1);
    expect(blocks.money.render).toHaveBeenCalledTimes(1);
    expect(blocks.signupSource.render).toHaveBeenCalledTimes(1);
    expect(out).toContain('перенос данных: 2');
    expect(out).toContain('кнопка плюс: 4');
    expect(out).toContain('баннеры-переходы: 6');
    expect(out).toContain('установка с сайта: 8');
    expect(out).toContain('настройка экранов: 1');
    expect(out).toContain('паттерны со вкладки «Я»: 4');
    expect(out).toContain('вход в мессенджере: всё хорошо');
    expect(out).toContain('поломки на клиенте: не было');
    expect(out).toContain('деньги: поддержали 3 раза');
    expect(out).toContain('новенькие по ссылкам: 5');
  });
});
