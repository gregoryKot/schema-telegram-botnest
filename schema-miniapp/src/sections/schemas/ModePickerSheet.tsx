import { useState } from 'react';
import { MODE_GROUPS, ALL_MODES } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { BottomSheet } from '../../components/BottomSheet';
import { cm } from './utils';

const POPULAR_MODE_IDS = [
  'vulnerable_child',
  'detached_protector',
  'demanding_critic',
  'abandoned_child',
  'compliant_surrenderer',
];

const MODE_DESC: Record<string, string> = {
  vulnerable_child: 'Беспомощность, грусть, страх — нуждается в защите',
  lonely_child: 'Одиночество и непонятость даже среди людей',
  abandoned_child: 'Страх быть брошенным, тревога при угрозе отношениям',
  humiliated_child: 'Стыд и ощущение дефективности, страх осуждения',
  dependent_child: 'Нужна постоянная поддержка, боится самостоятельных решений',
  angry_child: 'Злость из-за неудовлетворённых потребностей',
  stubborn_child: 'Упрямое сопротивление требованиям и контролю',
  enraged_child: 'Неконтролируемая ярость при угрозе или несправедливости',
  impulsive_child: 'Действует не думая, следует желаниям без учёта последствий',
  undisciplined_child: 'Избегает скучного, быстро теряет интерес и бросает',
  compliant_surrenderer: 'Соглашается со всем, чтобы избежать конфликта',
  helpless_surrenderer: 'Ощущает себя беспомощным, ждёт что другие всё решат',
  detached_protector:
    'Отключается эмоционально, уходит в себя чтобы не чувствовать',
  detached_self_soother: 'Успокаивает себя через еду, экраны, привычки',
  avoidant_protector: 'Избегает ситуаций и людей, которые могут причинить боль',
  angry_protector: 'Отталкивает других злостью, защищаясь от уязвимости',
  self_aggrandiser: 'Ощущение особости и превосходства над другими',
  overcontroller:
    'Стремится всё контролировать, тревожится от неопределённости',
  perfectionistic_oc: 'Недостижимые стандарты, страх малейшей ошибки',
  suspicious_oc: 'Постоянная настороженность, ищет скрытые угрозы',
  invincible_oc: 'Отрицает слабость — должен быть сильным всегда',
  flagellating_oc: 'Наказывает себя за ошибки строже чем нужно',
  compulsive_oc: 'Навязчивые ритуалы и действия для снижения тревоги',
  worrying_oc: 'Хроническое беспокойство о будущих катастрофах',
  bully_attack: 'Добивается своего через запугивание и агрессию',
  manipulative: 'Влияет на людей косвенно, скрывая истинные намерения',
  predator: 'Использует других в своих интересах без сочувствия',
  attention_seeker: 'Постоянно ищет признания и похвалы от окружающих',
  pollyanna: 'Отрицает проблемы, видит всё в розовом цвете',
  demanding_critic: 'Внутренний голос завышенных требований и критики',
  punitive_critic: 'Жёсткое внутреннее осуждение и приговоры себе',
  guilt_critic: 'Постоянное чувство вины и самообвинения',
  happy_child: 'Спонтанность, радость и игривость без тревоги',
  healthy_adult: 'Взвешенные решения, забота о себе и других',
  good_parent: 'Внутренний поддерживающий голос, ободряет и успокаивает',
};

export function ModePickerSheet({
  selected,
  onSave,
  onClose,
}: {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const [ids, setIds] = useState<string[]>(selected);
  const toggle = (id: string) =>
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 4,
          }}
        >
          Мои режимы
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Выбери режимы которые ты замечаешь у себя.',
            'Выберите режимы которые вы замечаете у себя.',
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-sub)',
              marginBottom: 8,
            }}
          >
            С чего начать
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {POPULAR_MODE_IDS.map((id) => {
              const mode = ALL_MODES.find((m) => m.id === id);
              if (!mode) return null;
              const active = ids.includes(id);
              const c = mode.groupColor; // CSS variable
              return (
                <div
                  key={id}
                  {...pressable(() => toggle(id))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: active ? cm(c, 9) : 'rgba(var(--fg-rgb),0.04)',
                    border: `1px solid ${active ? cm(c, 20) : 'rgba(var(--fg-rgb),0.08)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>
                    {mode.emoji}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: active ? 'var(--text)' : 'var(--text-sub)',
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      {mode.name}
                    </div>
                    {MODE_DESC[id] && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-sub)',
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {MODE_DESC[id]}
                      </div>
                    )}
                  </div>
                  {active && (
                    <span style={{ color: c, fontSize: 14, flexShrink: 0 }}>
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            height: 1,
            background: 'rgba(var(--fg-rgb),0.06)',
            marginBottom: 18,
          }}
        />
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 14,
          }}
        >
          Все режимы
        </div>

        {MODE_GROUPS.map((group) => {
          const c = group.color; // CSS variable
          return (
            <div key={group.id} style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: c,
                  marginBottom: 8,
                  opacity: 0.8,
                }}
              >
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items
                  .filter((m) => !POPULAR_MODE_IDS.includes(m.id))
                  .map((m) => {
                    const active = ids.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        {...pressable(() => toggle(m.id))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          background: active
                            ? cm(c, 9)
                            : 'rgba(var(--fg-rgb),0.03)',
                          border: `1px solid ${active ? cm(c, 20) : 'rgba(var(--fg-rgb),0.06)'}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>
                          {m.emoji}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              color: active ? 'var(--text)' : 'var(--text-sub)',
                              fontWeight: active ? 500 : 400,
                            }}
                          >
                            {m.name}
                          </div>
                          {MODE_DESC[m.id] && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-sub)',
                                marginTop: 2,
                                lineHeight: 1.4,
                              }}
                            >
                              {MODE_DESC[m.id]}
                            </div>
                          )}
                        </div>
                        {active && (
                          <span
                            style={{ color: c, fontSize: 14, flexShrink: 0 }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}

        <button
          onClick={() => {
            onSave(ids);
            onClose();
          }}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            background:
              'linear-gradient(135deg, var(--accent), var(--accent-blue))',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          Сохранить{ids.length > 0 ? ` (${ids.length})` : ''}
        </button>
      </div>
    </BottomSheet>
  );
}
