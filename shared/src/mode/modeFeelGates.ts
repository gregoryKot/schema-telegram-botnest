/**
 * Ворота выбора режима «по базовым чувствам» — единственный вход
 * ModeFeelingBrowse (webapp + miniapp, правило №3). Раньше ворота смешивали
 * три языка: чувство («Мне больно»), поведение («Держу контроль»), голос
 * («Ругаю себя») — новичок не знал, на каком языке думать. Здесь ворота —
 * только чувства (страшно / грустно / злюсь / стыдно / нет сил / пусто /
 * на подъёме / хорошо), а внутри — вопрос-уточнение (`question`) поверх
 * прежнего hint семьи.
 *
 * Листья переиспользуют уже выверенные тексты MODE_TEST_GROUPS/SECOND_DOORS/
 * MODE_UNKNOWN_GROUP (правило №11 — один источник формулировок, не третья
 * копия): `leafFor` берёт домашний лист по modeId, `fromDoor` — лист
 * конкретного второго входа, когда раскладка требует не домашнюю
 * формулировку, а формулировку кросс-входа (напр. attention_seeker в
 * воротах «Грустно» звучит как SECOND_DOORS.hurt, а не как домашний
 * grandiose-лист).
 *
 * Дубли modeId МЕЖДУ воротами — намеренные (один режим виден из двух
 * состояний, напр. avoidant_protector — и «Страшно», и «Нет сил»); ВНУТРИ
 * одних ворот дублей нет — покрыто modeFeelGates.test.ts.
 *
 * Домашняя таксономия (MODE_TEST_GROUPS, findTestGroupByModeId, modeChain)
 * этим файлом не меняется — ворота лишь по-новому группируют витрину.
 *
 * Импорт только в одну сторону: modeFeelGates → modeBodyCues → modeTest.
 * modeBodyCues НЕ импортирует отсюда (цикл modeFeelGates ⇄ modeBodyCues
 * ломает инициализацию модуля — тот, кто читает SECOND_DOORS/MODE_UNKNOWN_GROUP
 * первым, получит их до инициализации). Поэтому MODE_PICKER_GROUPS и
 * getModeLeafLabel живут здесь; UI-импорты указывают сюда, а не на
 * modeBodyCues.
 */
import type { ModeTestGroup, ModeTestLeaf } from './modeTest';
import { MODE_TEST_GROUPS } from './modeTest';
import { SECOND_DOORS, MODE_UNKNOWN_GROUP } from './modeBodyCues';

export interface FeelGate extends ModeTestGroup {
  /** вопрос-заголовок шага 2 («Какая это злость?») */
  question: string;
}

/** modeId → домашний лист (первое вхождение по MODE_TEST_GROUPS). */
const LEAF_LOOKUP = new Map<string, ModeTestLeaf>();
for (const group of MODE_TEST_GROUPS) {
  for (const leaf of group.leaves) {
    if (!LEAF_LOOKUP.has(leaf.modeId)) LEAF_LOOKUP.set(leaf.modeId, leaf);
  }
}

/** Домашний лист режима (label/desc/emoji из MODE_TEST_GROUPS), с точечным
 *  переопределением текста (label/desc) — для листьев, которым раскладка
 *  ворот требует формулировку второго входа, а не домашнюю. Все вызовы ниже —
 *  литеральные modeId, покрытые modeFeelGates.test.ts (35/35 + per-gate
 *  проверки), поэтому LEAF_LOOKUP.get гарантированно находит базовый лист —
 *  недостижимая ветка на опечатку не заводится (уронила бы coverage-храповик
 *  без реального сценария вызова). */
function leafFor(
  modeId: string,
  override?: Partial<Pick<ModeTestLeaf, 'label' | 'desc'>>,
): ModeTestLeaf {
  const base = LEAF_LOOKUP.get(modeId)!;
  return override ? { ...base, ...override } : base;
}

/** Формулировка конкретного второго входа (SECOND_DOORS[familyId]) —
 *  источник текста для leafFor(modeId, override), чтобы не перепечатывать
 *  уже выверенную фразу вручную. Тот же довод против ветки на опечатку, что
 *  и в leafFor. */
function fromDoor(
  familyId: string,
  modeId: string,
): Pick<ModeTestLeaf, 'label' | 'desc'> {
  const leaf = SECOND_DOORS[familyId].find((l) => l.modeId === modeId)!;
  return { label: leaf.label, desc: leaf.desc };
}

export const FEEL_GATES: FeelGate[] = [
  {
    id: 'fear',
    emoji: '😨',
    title: 'Страшно, тревожно',
    hint: 'страх и тревога — сигналы уязвимого внутри',
    question: 'Про что этот страх?',
    leaves: [
      leafFor('abandoned_child'),
      leafFor('dependent_child'),
      leafFor('vulnerable_child'),
      leafFor('worrying_oc'),
      leafFor('overcontroller'),
      leafFor('suspicious_oc'),
      leafFor('compulsive_oc'),
      leafFor('avoidant_protector'),
    ],
  },
  {
    id: 'sad',
    emoji: '😢',
    title: 'Грустно, одиноко',
    hint: 'грусти нужно присутствие, не решение',
    question: 'Какая это грусть?',
    leaves: [
      leafFor('vulnerable_child'),
      leafFor('lonely_child'),
      leafFor('attention_seeker', fromDoor('hurt', 'attention_seeker')),
      leafFor('helpless_surrenderer'),
    ],
  },
  {
    id: 'anger',
    emoji: '😠',
    title: 'Злюсь, вспыхиваю',
    hint: 'злость говорит о нарушенной границе или потребности',
    question: 'Какая это злость?',
    leaves: [
      leafFor('angry_child'),
      leafFor('enraged_child'),
      leafFor('angry_protector', fromDoor('anger', 'angry_protector')),
      leafFor('bully_attack', fromDoor('anger', 'bully_attack')),
      leafFor('stubborn_child'),
      leafFor('impulsive_child'),
    ],
  },
  {
    id: 'shame',
    emoji: '😳',
    title: 'Стыдно или виноват',
    hint: 'стыд и вина часто звучат чужим голосом',
    question: 'Кто это говорит внутри?',
    leaves: [
      leafFor('humiliated_child'),
      leafFor('punitive_critic'),
      leafFor('guilt_critic'),
      leafFor('demanding_critic'),
      leafFor('perfectionistic_oc'),
      leafFor('flagellating_oc', fromDoor('critic', 'flagellating_oc')),
      leafFor('compliant_surrenderer', {
        label: 'Неловко отказать — соглашаюсь',
      }),
    ],
  },
  {
    id: 'drained',
    emoji: '🥱',
    title: 'Нет сил, ничего не хочется',
    hint: 'истощение — тоже сигнал, а не лень',
    question: 'Как это выглядит?',
    leaves: [
      leafFor('avoidant_protector'),
      leafFor('undisciplined_child', fromDoor('avoid', 'undisciplined_child')),
      leafFor('helpless_surrenderer'),
      leafFor('detached_self_soother'),
    ],
  },
  {
    id: 'unknown',
    emoji: '🌫️',
    title: 'Пусто или не пойму, что чувствую',
    hint: MODE_UNKNOWN_GROUP.hint,
    question: 'Пусть подскажет тело',
    leaves: [...MODE_UNKNOWN_GROUP.leaves],
  },
  {
    id: 'above',
    emoji: '😎',
    title: 'На подъёме, выше других',
    hint: 'за блеском и бронёй обычно прячется страх',
    question: 'Что за подъём?',
    leaves: [
      leafFor('self_aggrandiser'),
      leafFor('invincible_oc'),
      leafFor('manipulative'),
      leafFor('predator'),
      leafFor('attention_seeker'),
      leafFor('bully_attack'),
    ],
  },
  {
    id: 'ok',
    emoji: '🌿',
    title: 'Спокойно, хорошо',
    hint: 'ресурсное состояние — можно побыть в нём',
    question: 'Настоящее ли это спокойствие?',
    leaves: [
      leafFor('healthy_adult'),
      leafFor('happy_child'),
      leafFor('good_parent'),
      leafFor('pollyanna', fromDoor('ok', 'pollyanna')),
    ],
  },
];

/** Имя для UI/тестов — те же ворота, что и FEEL_GATES (историческое имя из
 *  эпохи до редизайна на чувства, оставлено ради минимального диффа
 *  консьюмеров). */
export const MODE_PICKER_GROUPS: FeelGate[] = FEEL_GATES;

/** Человеческая фраза режима из ворот (label первого вхождения) — для мест,
 *  где режим упоминается вне своего списка (лист сомнений): сначала фраза,
 *  термин — справкой (правило «глазами новичка»). */
export function getModeLeafLabel(modeId: string): string | undefined {
  for (const g of FEEL_GATES)
    for (const l of g.leaves) if (l.modeId === modeId) return l.label;
  return undefined;
}
