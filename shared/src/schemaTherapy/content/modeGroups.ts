import type { ModeGroup } from '../types';
import { MODE_GROUP_HUE, toneHex } from '../../theme/entityHue';
import { OVERCOMPENSATION_MODE_ITEMS } from './modeGroupsOvercompensation';

// Единственный источник контента схема-терапии (правило №3 CLAUDE.md):
// раньше дублировался построчно в обоих фронтендах, теперь берут отсюда.

// ─── 36 Modes (schema-therapy.ru/modes, МИСТ) ──────────────────────────────

export const MODE_GROUPS: ModeGroup[] = [
  {
    id: 'child',
    group: 'Детские режимы',
    color: toneHex(MODE_GROUP_HUE.child),
    items: [
      // Уязвимые
      {
        id: 'vulnerable_child',
        name: 'Уязвимый Ребёнок',
        emoji: '🥺',
        short:
          'Ощущение беспомощности, грусти, страха — нуждается в защите и утешении',
      },
      {
        id: 'lonely_child',
        name: 'Одинокий Ребёнок',
        emoji: '😞',
        short: 'Одиночество и непонятость даже среди людей',
      },
      {
        id: 'abandoned_child',
        name: 'Покинутый Ребёнок',
        emoji: '💔',
        short: 'Страх, что бросят, и боль от того, что обижали',
      },
      {
        id: 'humiliated_child',
        name: 'Униженный Ребёнок',
        emoji: '😶‍🌫️',
        short: 'Стыд и ощущение дефективности, страх осуждения',
      },
      {
        id: 'dependent_child',
        name: 'Зависимый Ребёнок',
        emoji: '🫂',
        short: 'Нужна постоянная поддержка, страх самостоятельных решений',
      },
      // Агрессивные
      {
        id: 'angry_child',
        name: 'Сердитый Ребёнок',
        emoji: '😤',
        short: 'Злость из-за неудовлетворённых потребностей',
      },
      {
        id: 'stubborn_child',
        name: 'Упрямый Ребёнок',
        emoji: '🙅',
        short: 'Упрямое сопротивление требованиям и контролю',
      },
      {
        id: 'enraged_child',
        name: 'Разъярённый Ребёнок',
        emoji: '🔴',
        short: 'Неконтролируемая ярость при угрозе или несправедливости',
      },
      // Импульсивные
      {
        id: 'impulsive_child',
        name: 'Импульсивный Ребёнок',
        emoji: '⚡',
        short: 'Действует не думая, следует желаниям без учёта последствий',
      },
      {
        id: 'undisciplined_child',
        name: 'Недисциплинированный Ребёнок',
        emoji: '🌀',
        short: 'Избегает скучного, быстро теряет интерес и бросает',
      },
    ],
  },
  {
    id: 'coping_surrender',
    group: 'Копинг: Капитуляция',
    color: toneHex(MODE_GROUP_HUE.coping_surrender),
    items: [
      {
        id: 'compliant_surrenderer',
        name: 'Послушный Капитулянт',
        emoji: '😶',
        short: 'Соглашается со всем, чтобы избежать конфликта',
      },
      {
        id: 'helpless_surrenderer',
        name: 'Беспомощный Капитулянт',
        emoji: '🫠',
        short: 'Ощущает себя беспомощным, ждёт что другие всё решат',
      },
    ],
  },
  {
    id: 'coping_avoidance',
    group: 'Копинг: Избегание',
    color: toneHex(MODE_GROUP_HUE.coping_avoidance),
    items: [
      {
        id: 'detached_protector',
        name: 'Отстранённый Защитник',
        emoji: '🌫️',
        short: 'Отключается эмоционально, уходит в себя чтобы не чувствовать',
      },
      {
        id: 'detached_self_soother',
        name: 'Отстранённый Самоутешитель',
        emoji: '🛋️',
        short: 'Успокаивает себя через еду, экраны, привычки',
      },
      {
        id: 'avoidant_protector',
        name: 'Избегающий Защитник',
        emoji: '🚪',
        short: 'Избегает ситуаций и людей, которые могут причинить боль',
      },
      {
        id: 'angry_protector',
        name: 'Гневный Защитник',
        emoji: '😡',
        short: 'Отталкивает других злостью, защищаясь от уязвимости',
      },
    ],
  },
  {
    id: 'coping_overcompensation',
    group: 'Копинг: Гиперкомпенсация',
    color: toneHex(MODE_GROUP_HUE.coping_overcompensation),
    items: OVERCOMPENSATION_MODE_ITEMS,
  },
  {
    id: 'critic',
    group: 'Критикующие режимы',
    color: toneHex(MODE_GROUP_HUE.critic),
    items: [
      {
        id: 'demanding_critic',
        name: 'Требовательный Критик',
        emoji: '😬',
        short: 'Внутренний голос завышенных требований и критики',
      },
      {
        id: 'punitive_critic',
        name: 'Карающий Критик',
        emoji: '😠',
        short: 'Жёсткое внутреннее осуждение и приговоры себе',
      },
      {
        id: 'guilt_critic',
        name: 'Внушающий Вину Критик',
        emoji: '😔',
        short: 'Голос долга перед другими: вызывает вину за собственные потребности и за отказ',
      },
    ],
  },
  {
    id: 'healthy',
    group: 'Здоровые режимы',
    color: toneHex(MODE_GROUP_HUE.healthy),
    items: [
      {
        id: 'happy_child',
        name: 'Счастливый Ребёнок',
        emoji: '😄',
        short: 'Спонтанность, радость и игривость без тревоги',
      },
      {
        id: 'healthy_adult',
        name: 'Здоровый Взрослый',
        emoji: '🌿',
        short: 'Взвешенные решения, забота о себе и других',
      },
      {
        id: 'good_parent',
        name: 'Хороший Родитель',
        emoji: '💚',
        short: 'Внутренний поддерживающий голос, ободряет и успокаивает',
      },
    ],
  },
];
