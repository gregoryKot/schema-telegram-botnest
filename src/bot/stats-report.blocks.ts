// Список продуктовых блоков /stats: имя + сервис. Порядок здесь — порядок в
// полном отчёте и внутри раздела (stats-sections.ts). Вынесен из
// StatsReportService, чтобы сервис не рос (№10) и имена блоков были доступны
// тесту-сверке с разделами (№4) без поднятия сервисов.

export interface Renderable {
  render(): string | Promise<string>;
}

export interface StatsBlockDeps {
  product: Renderable;
  modeCard: Renderable;
  modeDiary: Renderable;
  warmWords: Renderable;
  phraseChecks: Renderable;
  entryDelete: Renderable;
  accountLink: Renderable;
  plus: Renderable;
  siteInstall: Renderable;
  screen: Renderable;
  profilePattern: Renderable;
  conceptGraph: Renderable;
  screenShare: Renderable;
  guideReference: Renderable;
  authHealth: Renderable;
  loginTicket: Renderable;
  clientErrors: Renderable;
  notifyQueue: Renderable;
  money: Renderable;
  sessionCurrency: Renderable;
  signupSource: Renderable;
  game: Renderable;
  dataExport: Renderable;
  bookingRetention: Renderable;
  introLeads: Renderable;
  therapyNudge: Renderable;
  therapyInvites: Renderable;
  clientBooking: Renderable;
  therapistExit: Renderable;
  crawlers: Renderable;
}

export interface StatsBlock {
  name: string;
  svc: Renderable;
}

export function statsBlocks(d: StatsBlockDeps): StatsBlock[] {
  return [
    { name: 'Как пользуются продуктом', svc: d.product },
    { name: 'Карточки режимов', svc: d.modeCard },
    { name: 'Дневник режимов', svc: d.modeDiary },
    { name: 'Тёплые слова', svc: d.warmWords },
    { name: 'Разбор фразы: критик или забота', svc: d.phraseChecks },
    { name: 'Удаление своих записей', svc: d.entryDelete },
    { name: 'Перенос данных из другого приложения', svc: d.accountLink },
    { name: 'Кнопка плюс', svc: d.plus },
    { name: 'Установка с сайта', svc: d.siteInstall },
    { name: 'Настройка экранов', svc: d.screen },
    { name: 'Паттерны со вкладки Я', svc: d.profilePattern },
    { name: 'Графическая концептуализация', svc: d.conceptGraph },
    { name: 'Показ экрана в кабинете', svc: d.screenShare },
    { name: 'Справочник терапевта', svc: d.guideReference },
    { name: 'Вход в мессенджере', svc: d.authHealth },
    { name: 'Вход по коду', svc: d.loginTicket },
    { name: 'Поломки на клиенте', svc: d.clientErrors },
    { name: 'Напоминания из бота', svc: d.notifyQueue },
    { name: 'Деньги', svc: d.money },
    { name: 'Сессии не в рублях', svc: d.sessionCurrency },
    { name: 'Откуда пришли новенькие', svc: d.signupSource },
    { name: 'Игра', svc: d.game },
    { name: 'Забирают свои данные', svc: d.dataExport },
    { name: 'Данные записей', svc: d.bookingRetention },
    { name: 'Заявки с формы знакомства', svc: d.introLeads },
    { name: 'Мост к терапевту', svc: d.therapyNudge },
    { name: 'Приглашения клиентов', svc: d.therapyInvites },
    { name: 'Запись из приложения', svc: d.clientBooking },
    { name: 'Терапевты уходят', svc: d.therapistExit },
    { name: 'Роботы нейросетей', svc: d.crawlers },
  ];
}
