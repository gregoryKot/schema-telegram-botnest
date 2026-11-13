// Гейт «в сообщении клиенту в Telegram нет данных о состоянии» (РКН, #1135;
// политика, п. 3.5). Каждый тип из NotificationType рендерится с payload-ловушкой:
// любой ключ вне белого списка отдаёт маркер (строку или число). Маркер в тексте
// или кнопках = шаблон читает из очереди то, что читать нельзя (оценки, средние,
// названия потребностей, текст плана или задания). Новый тип без записи в SAFE
// не компилируется (Record по NotificationType).
import { renderTemplate } from '../../notification/notification.templates';
import type { NotificationType } from '../../notification/notification.types';

type Render = (
  type: NotificationType,
  payload: Record<string, unknown>,
  form: 'ty' | 'vy',
) => { text: string; keyboard?: unknown } | null;

// Белый список: ключи payload, которые шаблон вправе читать, и безопасные
// значения — счётчики активности, ротация текста, номера, имя терапевта, вид
// уведомления безопасности. Всё остальное — ловушка.
const SAFE: Record<NotificationType, Record<string, unknown>> = {
  reminder: {
    streak: 5,
    variant: 1,
    gamified: true,
    approachingStreak: 7,
    onBreak: false,
    compactControls: true,
  },
  pre_reminder: {},
  summary: {},
  comeback: { totalDays: 12 },
  welcome_back: {},
  onboarding_1: {},
  onboarding_3: {},
  onboarding_7: {},
  streak_7: {},
  streak_14: {},
  streak_30: {},
  lapsing_3: {},
  dormant_7: {},
  value_recap: { totalDays: 14 },
  reengagement_30: {},
  weekly: {},
  donate_reminder: { seed: 1, totalDays: 45 },
  anniversary_30: {},
  anniversary_60: {},
  anniversary_90: {},
  practice_reminder: {},
  practice_missed: { weekday: 5 },
  low_streak_insight: {},
  nudge: { daysSince: 75 },
  task_assigned: { taskId: 9 },
  ysq_requested: { therapistName: 'Анна' },
  pair_activity: {},
  security_notice: { kind: 'provider_linked', provider: 'google' },
};

const TYPES = Object.keys(SAFE) as NotificationType[];
const MARKERS: unknown[] = ['LEAK_MARKER_Zq7', 7771234];

function trapPayload(
  type: NotificationType,
  marker: unknown,
): Record<string, unknown> {
  const safe = SAFE[type];
  return new Proxy(
    {},
    {
      get: (_t, key) =>
        typeof key === 'symbol' ? undefined : key in safe ? safe[key] : marker,
      has: () => true,
    },
  );
}

/** Типы и формы, в чьих сообщениях нашёлся маркер ловушки. */
function leaks(render: Render): string[] {
  const out: string[] = [];
  for (const type of TYPES) {
    for (const marker of MARKERS) {
      for (const form of ['ty', 'vy'] as const) {
        const tpl = render(type, trapPayload(type, marker), form);
        const seen = `${tpl?.text ?? ''}${JSON.stringify(tpl?.keyboard ?? null)}`;
        if (seen.includes(String(marker))) {
          out.push(`${type} (${form}, ${typeof marker})`);
        }
      }
    }
  }
  return out;
}

describe('гейт: шаблоны уведомлений не выводят данные состояния из payload', () => {
  it('боевые шаблоны: ни одного маркера в тексте и кнопках', () => {
    expect(leaks(renderTemplate)).toEqual([]);
  });

  it('контроль: шаблон, читающий payload.text и числа, краснеет', () => {
    const leaky: Render = (_type, payload) => ({
      text: `${String(payload.text)} ${String(payload.avg)}`,
    });
    expect(leaks(leaky).length).toBe(TYPES.length * MARKERS.length * 2);
  });

  it('контроль: маркер в кнопке тоже виден', () => {
    const leaky: Render = (_type, payload) => ({
      text: 'ok',
      keyboard: [{ url: `https://x/?q=${String(payload.needId)}` }],
    });
    expect(leaks(leaky).length).toBeGreaterThan(0);
  });

  it('белый список не пропускает чужие ключи: ловушка отдаёт маркер на любой ключ вне SAFE', () => {
    const p = trapPayload('weekly', 'M');
    expect(p.text).toBe('M');
    expect(trapPayload('task_assigned', 'M').taskId).toBe(9);
  });

  it('боевые шаблоны остаются непустыми: гейт не молчит из-за null', () => {
    for (const type of TYPES) {
      expect(renderTemplate(type, SAFE[type], 'ty')).not.toBeNull();
    }
  });
});
