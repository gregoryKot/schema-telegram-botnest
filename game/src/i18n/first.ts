// Тексты эпилога «Первая встреча» и финальной карточки «Недели» (сценарий — game/GAME_CONCEPT.md).
// Терапевт говорит с Сашей на «вы»; режимы — с заглавных, по docs/TERMINOLOGY.md.
import type { Msg } from './messages';

const wk = (ru: string): Msg => ({ ru, en: ru });

export const FIRST_TEXT = {
  m_open_app: { ru: "Открыть приложение", en: "Open the app" },
  // заставка
  m_wk_first_invite: wk("Дальше — первая встреча"),
  m_wk_first_day: wk("ПЕРВАЯ ВСТРЕЧА"),
  m_wk_first_about: wk("Эпилог недели"),
  m_wk_first_again: wk("Первая встреча уже пройдена — можно ещё раз"),
  m_wk_first_who: wk("Это Саша. Первый раз у терапевта"),
  m_wk_goal_tell: wk("цель: сесть в кресло и рассказать"),
  m_wk_goal_chair: wk("цель: дойти до кресла"),
  m_wk_therapist_tag: wk("терапевт"),
  // строки внутри мира, по порядку кадров
  m_wk_first_hello: wk("Здравствуйте, Саша. Кресло ваше"),
  m_wk_first_ask: wk("Расскажите про понедельник"),
  m_wk_first_glitch_thought: wk("Здесь ничего не сбоит. А кресло не ближе"),
  m_wk_first_try_overwork: wk("Рассказать бы чётко, по пунктам, без запинок"),
  m_wk_first_try_scroll: wk("Сколько там ещё времени?"),
  m_wk_first_tired: wk("Может, дело в усталости?"),
  m_wk_first_try_agree: wk("Проще кивнуть: да, усталость"),
  // привычки приходят и сюда — терапевт замечает каждую вслух, без оценки
  m_wk_first_notice_overwork: wk("Вы рассказываете, как сдают отчёт. Здесь оценок не ставят"),
  m_wk_first_notice_scroll: wk("Взгляд ушёл на часы. Время есть. Я здесь"),
  m_wk_first_notice_agree: wk("Со мной можно не соглашаться"),
  m_wk_first_stop: wk("Давайте остановимся. Вместе"),
  // ПАУЗА вдвоём
  m_wk_first_step1: wk("ПАУЗА ВДВОЁМ · шаг 1 из 2: назвать"),
  m_wk_first_step2: wk("ПАУЗА ВДВОЁМ · шаг 2 из 2: что нужно"),
  m_wk_first_p1_wrong: wk("Я рассказываю неправильно"),
  m_wk_first_p1_seen: wk("Мне страшно, что меня увидят"),
  m_wk_first_p1_ready: wk("Надо было подготовиться"),
  m_wk_first_between: wk("Сказано вслух — и никто не отвернулся. Что мне нужно?"),
  m_wk_first_p2_like: wk("Понравиться терапевту"),
  m_wk_first_p2_leave: wk("Уйти пораньше"),
  m_wk_first_p2_stay: wk("Чтобы со мной побыли, пока страшно"),
  m_wk_first_named: wk("До кресла десять шагов. Столько и было"),
  m_wk_first_end: wk("Сегодня мы ничего не чинили. Мы начали"),
  m_wk_first_after: wk("Приду в четверг"),

  // финальная карточка: кто был в игре — режимы по именам, и что с этим делают в терапии
  m_wk_final_kicker: wk("кто был в этой неделе"),
  m_wk_final_lead: wk("В схема-терапии это называют режимами: они включаются, когда задето старое. Они есть у всех."),
  m_wk_final_critic: wk("Требовательный Критик"),
  m_wk_final_critic_is: wk("голос «старайся сильнее»"),
  m_wk_final_protector: wk("Отстранённый Защитник"),
  m_wk_final_protector_is: wk("уводит в телефон и к выходу"),
  m_wk_final_child: wk("Уязвимый Ребёнок"),
  m_wk_final_child_is: wk("маленький Саша: страшно и одиноко"),
  m_wk_final_adult: wk("Здоровый Взрослый"),
  m_wk_final_adult_is: wk("тот, кто делает ПАУЗУ"),
  m_wk_final_close: wk("Здорового Взрослого в терапии растят вдвоём. Первая встреча ничего не чинит — она начинает."),
  m_wk_final_again: wk("Пройти неделю заново"),
} satisfies Record<string, Msg>;
