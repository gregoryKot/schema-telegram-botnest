/**
 * Тест «какой режим включился» — определение по ФУНКЦИИ, а не по названию.
 *
 * Клинически режим надёжнее всего опознаётся по тому, что человек *делает* с
 * болью (капитуляция / избегание / гиперкомпенсация), а не по ярлыку. Поэтому
 * шаг 1 — крупное «что со мной сейчас» (функциональная семья), шаг 2 —
 * уточнение внутри семьи. Вместо свалки из 35 режимов: сначала ~8, потом ~2–7.
 *
 * Данные form-agnostic: метки — самоутверждения от 1-го лица («я …») и
 * нейтральные описания, поэтому развод по форме обращения здесь НЕ нужен
 * (правило обращения в CLAUDE.md: 1-е лицо и номинативы не разводятся).
 *
 * modeId каждого листа обязан совпадать с id в MODE_GROUPS (schemaTherapyData).
 * Синхронность закреплена тестом modeTest.test.ts (правило №4).
 */

export interface ModeTestLeaf {
  /** id режима — маппится в MODE_GROUPS.items[].id */
  modeId: string;
  emoji: string;
  /** ощущение от 1-го лица, по которому узнаётся режим */
  label: string;
}

export interface ModeTestGroup {
  id: string;
  emoji: string;
  /** крупное состояние «что со мной сейчас» */
  title: string;
  /** короткая нейтральная подсказка про функцию семьи */
  hint: string;
  leaves: ModeTestLeaf[];
}

export const MODE_TEST_GROUPS: ModeTestGroup[] = [
  {
    id: 'hurt',
    emoji: '😢',
    title: 'Мне больно, страшно, одиноко',
    hint: 'детская боль — нужна забота и присутствие',
    leaves: [
      {
        modeId: 'vulnerable_child',
        emoji: '🥺',
        label: 'Одиноко, страшно, грустно',
      },
      {
        modeId: 'lonely_child',
        emoji: '😞',
        label: 'Одиноко даже среди людей',
      },
      {
        modeId: 'abandoned_child',
        emoji: '💔',
        label: 'Боюсь, что бросят или уйдут',
      },
      {
        modeId: 'humiliated_child',
        emoji: '😶‍🌫️',
        label: 'Стыдно, чувствую себя дефектным',
      },
      {
        modeId: 'dependent_child',
        emoji: '🫂',
        label: 'Страшно решать самому',
      },
    ],
  },
  {
    id: 'anger',
    emoji: '😤',
    title: 'Злюсь, бунтую, не могу усидеть',
    hint: 'нарушены границы или потребности',
    leaves: [
      {
        modeId: 'angry_child',
        emoji: '😤',
        label: 'Злюсь — это несправедливо',
      },
      { modeId: 'enraged_child', emoji: '🔴', label: 'Внутри всё вскипает' },
      {
        modeId: 'stubborn_child',
        emoji: '🙅',
        label: 'Не хочу, не буду, сопротивляюсь',
      },
      {
        modeId: 'impulsive_child',
        emoji: '⚡',
        label: 'Не могу терпеть, хочу сейчас',
      },
      {
        modeId: 'undisciplined_child',
        emoji: '🌀',
        label: 'Скучно, бросаю на полпути',
      },
    ],
  },
  {
    id: 'avoid',
    emoji: '🌫️',
    title: 'Отключаюсь, убегаю, залипаю',
    hint: 'уход от боли — «беги»',
    leaves: [
      {
        modeId: 'detached_protector',
        emoji: '🌫️',
        label: 'Онемение, «не трогайте меня»',
      },
      {
        modeId: 'detached_self_soother',
        emoji: '🛋️',
        label: 'Тянет к телефону, еде, сериалу',
      },
      {
        modeId: 'avoidant_protector',
        emoji: '🚪',
        label: 'Не хочу даже думать об этом',
      },
      {
        modeId: 'angry_protector',
        emoji: '😡',
        label: 'Злюсь и отталкиваю людей',
      },
    ],
  },
  {
    id: 'surrender',
    emoji: '😶',
    title: 'Терплю, подчиняюсь, не могу отказать',
    hint: 'сдача перед схемой — «замри»',
    leaves: [
      {
        modeId: 'compliant_surrenderer',
        emoji: '😶',
        label: 'Соглашаюсь, хотя не хочу',
      },
      {
        modeId: 'helpless_surrenderer',
        emoji: '🫠',
        label: 'Беспомощно, жду, что решат за меня',
      },
    ],
  },
  {
    id: 'control',
    emoji: '🎛️',
    title: 'Держу контроль, перепроверяю, тревожусь',
    hint: 'тревогу глушат контролем',
    leaves: [
      {
        modeId: 'overcontroller',
        emoji: '🎛️',
        label: 'Всё должно быть под контролем',
      },
      {
        modeId: 'worrying_oc',
        emoji: '😟',
        label: 'Прокручиваю худшее снова и снова',
      },
      {
        modeId: 'perfectionistic_oc',
        emoji: '✅',
        label: 'Сделал, но всё равно недостаточно',
      },
      {
        modeId: 'suspicious_oc',
        emoji: '🔍',
        label: 'Ищу скрытые мотивы, не доверяю',
      },
      {
        modeId: 'invincible_oc',
        emoji: '🛡️',
        label: 'Нельзя показывать слабость',
      },
      {
        modeId: 'flagellating_oc',
        emoji: '😩',
        label: 'Наказываю себя строже, чем нужно',
      },
      {
        modeId: 'compulsive_oc',
        emoji: '🔁',
        label: 'Ритуалы и навязчивые действия',
      },
    ],
  },
  {
    id: 'grandiose',
    emoji: '🔥',
    title: 'Возвышаюсь, давлю на других',
    hint: 'сила снаружи — страх внутри',
    leaves: [
      {
        modeId: 'self_aggrandiser',
        emoji: '🔥',
        label: 'Контролирую, превосхожу других',
      },
      {
        modeId: 'bully_attack',
        emoji: '👊',
        label: 'Добиваюсь через давление и напор',
      },
      {
        modeId: 'manipulative',
        emoji: '🎭',
        label: 'Влияю косвенно, скрываю намерения',
      },
      {
        modeId: 'predator',
        emoji: '🦊',
        label: 'Использую других в своих целях',
      },
      {
        modeId: 'attention_seeker',
        emoji: '🌟',
        label: 'Нужны признание и похвала',
      },
      {
        modeId: 'pollyanna',
        emoji: '🌈',
        label: 'Всё хорошо, не вижу проблем',
      },
    ],
  },
  {
    id: 'critic',
    emoji: '🗯️',
    title: 'Ругаю себя: «я плохой», «виноват»',
    hint: 'усвоенный чужой голос, не свой',
    leaves: [
      {
        modeId: 'punitive_critic',
        emoji: '😠',
        label: 'Стыдно, «я плохой», наказываю себя',
      },
      {
        modeId: 'demanding_critic',
        emoji: '😬',
        label: 'Давление: «надо больше, недостаточно»',
      },
      { modeId: 'guilt_critic', emoji: '😔', label: 'Виноват, должен всем' },
    ],
  },
  {
    id: 'ok',
    emoji: '🌿',
    title: 'Вроде спокойно, я в порядке',
    hint: 'ресурсное состояние — можно побыть в нём',
    leaves: [
      { modeId: 'healthy_adult', emoji: '🌿', label: 'Спокойно и устойчиво' },
      { modeId: 'happy_child', emoji: '😄', label: 'Легко и радостно' },
      {
        modeId: 'good_parent',
        emoji: '💚',
        label: 'Поддерживаю и ободряю себя',
      },
    ],
  },
];

/** Все modeId из теста (для сверки с MODE_GROUPS и преселекта). */
export const ALL_TEST_MODE_IDS: string[] = MODE_TEST_GROUPS.flatMap((g) =>
  g.leaves.map((l) => l.modeId),
);

/** Найти семью, к которой относится режим (для показа результата). */
export function findTestGroupByModeId(
  modeId: string,
): ModeTestGroup | undefined {
  return MODE_TEST_GROUPS.find((g) =>
    g.leaves.some((l) => l.modeId === modeId),
  );
}
