// Словарь «событие аналитики → фича продукта» для админки. Названия — как у
// блоков /stats (stats-sections.ts), без имён событий. Сверка с реестром —
// admin-feature-dictionary.spec.ts (№4): новое событие красит тест, пока его
// нет здесь или в OTHER_EVENTS.
import type { AnalyticsEventName } from '../analytics.constants';

export interface FeatureDef {
  id: string;
  title: string;
  events: readonly AnalyticsEventName[];
}

export const OTHER_FEATURE = { id: 'other', title: 'Другое' } as const;

export const FEATURES: readonly FeatureDef[] = [
  {
    id: 'share',
    title: 'Поделиться карточкой',
    events: ['share_card', 'share_result'],
  },
  {
    id: 'crisis',
    title: 'Кризисная карточка',
    events: ['crisis_card_shown', 'crisis_hotline_tapped'],
  },
  {
    id: 'diary',
    title: 'Дневник и трекер',
    events: ['today_streak_toggle', 'tracker_skip', 'diary_quick_save'],
  },
  {
    id: 'calm',
    title: 'Дыхание и «Стоп»',
    events: ['breath_start', 'stop_start', 'practice_link_click'],
  },
  {
    id: 'onboarding',
    title: 'Знакомство с приложением',
    events: ['onboarding_step'],
  },
  {
    id: 'home',
    title: 'Главный экран',
    events: [
      'home_screen_offer',
      'quick_action_toggle',
      'quick_action_move',
      'screen_customize_open',
      'screen_block_toggle',
      'screen_block_move',
      'home_tile',
    ],
  },
  {
    id: 'login',
    title: 'Вход и привязка аккаунта',
    events: [
      'login_method_offer',
      'account_link_started',
      'account_link_confirmed',
      'account_link_failed',
      'login_ticket_step',
      'login_one_tap',
      'login_oauth',
      'messenger_launch',
      'messenger_launch_failed',
      'signup_source',
    ],
  },
  { id: 'journey', title: 'Мой путь', events: ['journey_open'] },
  {
    id: 'quiz',
    title: 'Опросники',
    events: ['ysq_help_open', 'quiz_started', 'quiz_completed'],
  },
  {
    id: 'data',
    title: 'Свои данные: выгрузка и удаление',
    events: ['data_export', 'ysq_data_deleted', 'entry_deleted'],
  },
  {
    id: 'mode_cards',
    title: 'Карточки режимов',
    events: ['mode_card_saved', 'mode_test_completed'],
  },
  {
    id: 'mode_diary',
    title: 'Дневник режимов',
    events: [
      'mode_entry_saved',
      'mode_chain_followup',
      'mode_doubt_opened',
      'mode_doubt_switched',
    ],
  },
  { id: 'warm', title: 'Тёплые слова', events: ['warm_words_open'] },
  {
    id: 'patterns',
    title: 'Паттерны со вкладки Я',
    events: ['profile_pattern_open'],
  },
  {
    id: 'notify',
    title: 'Уведомления',
    events: [
      'reminder_snoozed',
      'push_subscribed',
      'push_unsubscribed',
      'push_gone',
      'push_denied',
    ],
  },
  {
    id: 'bridge',
    title: 'Мост к терапевту',
    events: ['therapy_invite', 'therapist_resigned', 'therapy_nudge'],
  },
  {
    id: 'concept',
    title: 'Графическая концептуализация',
    events: [
      'concept_graph_open',
      'concept_mode_linked',
      'concept_schema_linked',
      'concept_canvas_open',
      'concept_graph_fullscreen',
      'concept_save_retry',
      'concept_brief_open',
      'concept_sync_to_map',
      'concept_sync_from_map',
      'concept_needs_rated',
      'concept_shared',
      'client_concept_opened',
    ],
  },
  {
    id: 'guide',
    title: 'Справочник терапевта',
    events: [
      'concept_guide_mode_open',
      'concept_guide_schema_open',
      'concept_guide_technique_open',
      'concept_guide_assign',
      'concept_guide_mark_done',
      'concept_guide_journal_open',
      'concept_guide_journal_entry',
      'cabinet_guide_open',
      'cabinet_guide_mode_open',
      'cabinet_guide_schema_open',
      'cabinet_guide_technique_open',
      'cabinet_guide_note_open',
      'cabinet_guide_need_open',
      'cabinet_guide_concern_open',
      'cabinet_guide_phase_open',
      'cabinet_guide_table_open',
      'cabinet_guide_answer_show',
      'cabinet_guide_answer_link',
      'guide_mark_added',
    ],
  },
  {
    id: 'session',
    title: 'Сессия в кабинете',
    events: ['cabinet_session_work', 'cabinet_screen_share_on'],
  },
  {
    id: 'plan',
    title: 'План работы с клиентом',
    events: [
      'therapy_plan_item_added',
      'therapy_plan_item_status',
      'therapy_plan_session_marked',
    ],
  },
  {
    id: 'path',
    title: 'Путь клиента',
    events: [
      'therapy_path_created',
      'therapy_path_phase_started',
      'therapy_path_phase_finished',
      'therapy_path_dates_shifted',
      'therapy_path_draft_built',
    ],
  },
  { id: 'tasks', title: 'Задания клиентам', events: ['task_assign_source'] },
  { id: 'search', title: 'Поиск', events: ['search_result_open'] },
  {
    id: 'case',
    title: 'Разбор случая',
    events: ['case_started', 'case_scene', 'case_recognized', 'case_finished'],
  },
  {
    id: 'game',
    title: 'Игра',
    events: [
      'game_open',
      'game_chapter_start',
      'game_chapter_done',
      'game_cta_shown',
      'game_cta_click',
      'game_share',
      'game_app_arrive',
    ],
  },
  {
    id: 'booking',
    title: 'Запись на сессию',
    events: [
      'booking_slot_taken',
      'booking_currency_chosen',
      'client_booking_opened',
      'client_booking_created',
    ],
  },
  { id: 'links', title: 'Страница ссылок', events: ['links_page_click'] },
];

/** Служебные события: людям не показываются как фича, уходят в «Другое». */
export const OTHER_EVENTS: readonly AnalyticsEventName[] = [
  'outbox_flush',
  'auth_rejected',
  'client_error',
  'notify_queue_tick',
  'crawler_visits',
  'asset_recovered',
];

const BY_EVENT = new Map<string, { id: string; title: string }>(
  FEATURES.flatMap((f) =>
    f.events.map((e) => [e, { id: f.id, title: f.title }] as const),
  ),
);

export function featureOf(eventName: string): { id: string; title: string } {
  return BY_EVENT.get(eventName) ?? OTHER_FEATURE;
}
