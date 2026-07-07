import type { MsgKey } from '../i18n';

export interface EnemyContent {
  id: string;
  name: MsgKey;
  emoji: string;
  quote: MsgKey;
  text: MsgKey;
  tip: MsgKey;
}

export const ENEMIES: EnemyContent[] = [
  {
    id: 'anxiety',
    name: 'm_anxiety',
    emoji: '😰',
    quote: 'm_what_if_something_goes_wrong_better',
    text: 'm_anxiety_is_trying_to_protect_you',
    tip: 'm_anxiety_is_a_signal_not_a',
  },
  {
    id: 'procrastination',
    name: 'm_procrastination',
    emoji: '🛋️',
    quote: 'm_i_ll_start_as_soon_as',
    text: 'm_procrastination_isn_t_laziness_it_s',
    tip: 'm_the_feeling_of_being_ready_never',
  },
  {
    id: 'phone',
    name: 'm_the_phone',
    emoji: '📱',
    quote: 'm_just_five_more_minutes_one_more',
    text: 'm_endless_scrolling_isn_t_rest_it',
    tip: 'm_what_are_you_running_from_right',
  },
  {
    id: 'irritation',
    name: 'm_irritation',
    emoji: '😤',
    quote: 'm_why_is_everything_wrong_this_is',
    text: 'm_when_the_irritation_is_an_8',
    tip: 'm_the_intensity_of_the_anger_hints',
  },
  {
    id: 'selfcritic',
    name: 'm_the_self_critic',
    emoji: '🪞',
    quote: 'm_you_could_have_done_better_you',
    text: 'm_the_inner_critic_sounds_like_your',
    tip: 'm_tell_yourself_what_you_would_tell',
  },
];

export const SAGE_CONTENT = {
  emoji: '🌿',
  name: 'm_t_h_e_s_a_g',
  text: 'm_you_run_fast_they_always_come',
  tip: 'm_it_s_called_therapy',
  ctaUrl: 'https://schemehappens.ru',
  ctaLabel: 'm_learn_about_therapy',
} as const;

export const contentMap = Object.fromEntries(ENEMIES.map(e => [e.id, e]));
