import { useState } from 'react';
import { Need, COLORS, YESTERDAY } from '../types';
import { useNeedData } from '../needData';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { getTherapistContact } from '../utils/therapistContact';
import { useTr } from '../utils/addressForm';
import { PlanSheet } from './PlanSheet';
import { NeedRatingBar } from './NeedRatingBar';

interface Props {
  need: Need;
  value: number;
  yesterdayValue?: number;
  onChange: (v: number) => void;
  onClose: () => void;
  onPlanSaved?: (needId: string) => void;
  onOpenHelp?: () => void;
}

const DISCLAIMER_CONTENT = [
  'Дневник помогает видеть паттерны и чуть лучше понимать себя.',
  'Советы внутри — это приглашение к размышлению, не инструкция.',
  'Если что-то важное требует внимания — терапия это место, где можно разобраться по-настоящему. Безопасно, глубоко, рядом живой человек.',
];

export function NeedTodaySheet({
  need,
  value,
  yesterdayValue,
  onChange,
  onClose,
  onPlanSaved,
  onOpenHelp,
}: Props) {
  const tr = useTr();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [showRanges, setShowRanges] = useState(false);
  const NEED_DATA = useNeedData();
  const data = NEED_DATA[need.id];
  if (!data) return null;
  const color = COLORS[need.id] ?? '#888';

  const rangeIdx = value <= 3 ? 0 : value <= 6 ? 1 : 2;
  const RANGE_VALUES = [1, 4, 7];

  return (
    <BottomSheet onClose={onClose}>
      {/* Header — tap to close */}
      <div
        onClick={onClose}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          marginBottom: 24,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            flexShrink: 0,
            background: color + '26',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          {data.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            {need.chartLabel}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 20,
                  background: color + '1f',
                  color,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            fontSize: 20,
            color: 'var(--text-faint)',
            flexShrink: 0,
            lineHeight: 1,
            paddingTop: 2,
          }}
        >
          ✕
        </div>
      </div>

      {/* Section 5: Slider — at top for immediate access */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 4,
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color }}>{value}</span>
          <span
            style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-sub)' }}
          >
            /10
          </span>
        </div>
        <NeedRatingBar
          color={color}
          value={value}
          yesterday={YESTERDAY[need.id]}
          onChange={onChange}
        />
      </div>

      {/* High score affirmation */}
      {rangeIdx === 2 && (
        <div
          style={{
            background: color + '18',
            border: `1px solid ${color}33`,
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color,
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Сегодня ты позаботился об этой потребности — заметь это',
            'Сегодня вы позаботились об этой потребности — заметьте это',
          )}
        </div>
      )}

      {/* Section 1: Question */}
      <div style={{ marginBottom: 20 }}>
        <SectionLabel>{tr('Спроси себя', 'Спросите себя')}</SectionLabel>
        <div
          style={{
            fontSize: 15,
            color: 'rgba(var(--fg-rgb),0.85)',
            lineHeight: 1.6,
          }}
        >
          {data.question}
        </div>
      </div>

      {/* Section 1b: Examples — collapsible */}
      <div style={{ marginBottom: 24 }}>
        <div
          onClick={() => setShowExamples((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: showExamples ? 10 : 0,
          }}
        >
          <SectionLabel mb={0}>Как это выглядит в жизни</SectionLabel>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {showExamples ? '▴' : '▾'}
          </span>
        </div>
        {showExamples && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.examples.map((ex, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom:
                    i < data.examples.length - 1
                      ? '1px solid rgba(var(--fg-rgb),0.05)'
                      : 'none',
                }}
              >
                <span
                  style={{
                    color,
                    fontSize: 14,
                    flexShrink: 0,
                    lineHeight: 1.5,
                  }}
                >
                  ›
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: 'var(--text-sub)',
                    lineHeight: 1.5,
                  }}
                >
                  {ex}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 1c: Reflection questions — collapsible */}
      {data.reflection?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            onClick={() => setShowReflection((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: showReflection ? 10 : 0,
            }}
          >
            <SectionLabel mb={0}>Вопросы для рефлексии</SectionLabel>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {showReflection ? '▴' : '▾'}
            </span>
          </div>
          {showReflection && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.reflection.map((q, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom:
                      i < data.reflection.length - 1
                        ? '1px solid rgba(var(--fg-rgb),0.05)'
                        : 'none',
                  }}
                >
                  <span
                    style={{
                      color,
                      fontSize: 14,
                      flexShrink: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    ?
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--text-sub)',
                      lineHeight: 1.5,
                    }}
                  >
                    {q}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Range pills — collapsible */}
      <div style={{ marginBottom: 24 }}>
        <div
          onClick={() => setShowRanges((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: showRanges ? 10 : 0,
          }}
        >
          <SectionLabel mb={0}>Как понять оценку</SectionLabel>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {showRanges ? '▴' : '▾'}
          </span>
        </div>
        {showRanges && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.ranges.map((range, i) => {
              const active = i === rangeIdx;
              return (
                <div
                  key={range.label}
                  onClick={() => onChange(RANGE_VALUES[i])}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    background: active
                      ? color + '33'
                      : 'rgba(var(--fg-rgb),0.04)',
                    border: `1px solid ${active ? color + '55' : 'rgba(var(--fg-rgb),0.08)'}`,
                    borderRadius: 12,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: active ? color : 'rgba(var(--fg-rgb),0.2)',
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: active ? color : 'rgba(var(--fg-rgb),0.35)',
                        marginRight: 6,
                      }}
                    >
                      {range.label}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: active
                          ? 'rgba(var(--fg-rgb),0.85)'
                          : 'rgba(var(--fg-rgb),0.4)',
                        lineHeight: 1.5,
                      }}
                    >
                      {range.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Plan button + Help link (low score only) */}
      {value <= 3 && (
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            onClick={() => setShowPlan(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: color + '12',
              border: `1px solid ${color}28`,
              borderRadius: 12,
              padding: '12px 16px',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color }}>
                Сделать завтра что-то для себя
              </div>
              <div
                style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}
              >
                Один шаг — и напомним
              </div>
            </div>
            <div style={{ fontSize: 18, color: color + 'aa', flexShrink: 0 }}>
              ›
            </div>
          </div>
          {onOpenHelp && (
            <div
              onClick={() => {
                onClose();
                onOpenHelp();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background:
                  'color-mix(in srgb, var(--accent-red) 8%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)',
                borderRadius: 12,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--accent-red)',
                  }}
                >
                  Раздел Помощь
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-sub)',
                    marginTop: 2,
                  }}
                >
                  Инструменты прямо сейчас
                </div>
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: 'var(--accent-red)',
                  flexShrink: 0,
                }}
              >
                ›
              </div>
            </div>
          )}
        </div>
      )}

      {showPlan && (
        <PlanSheet
          needId={need.id}
          needEmoji={data.emoji}
          needLabel={need.chartLabel}
          color={color}
          onClose={() => setShowPlan(false)}
          onSaved={() => {
            setShowPlan(false);
            onPlanSaved?.(need.id);
            onClose();
          }}
        />
      )}

      {showDisclaimer && (
        <BottomSheet onClose={() => setShowDisclaimer(false)} zIndex={300}>
          <div style={{ paddingTop: 8 }}>
            <SectionLabel purple mb={16}>
              О советах
            </SectionLabel>
            {DISCLAIMER_CONTENT.map((p, i) => (
              <p
                key={i}
                style={{
                  fontSize: 15,
                  color: 'rgba(var(--fg-rgb),0.8)',
                  lineHeight: 1.7,
                  marginBottom: 14,
                }}
              >
                {p}
              </p>
            ))}
            <a
              href={getTherapistContact().url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                fontSize: 14,
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              →{' '}
              {getTherapistContact().name === 'автору'
                ? 'Поговорить с психологом'
                : `Написать ${getTherapistContact().name}`}
            </a>
          </div>
        </BottomSheet>
      )}
    </BottomSheet>
  );
}
