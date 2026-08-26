import { useState } from 'react';
import { Need, COLORS } from '../types';
import { useNeedData } from '../needData';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { useTr } from '../utils/addressForm';
import { PlanSheet } from './PlanSheet';
import { NeedRatingBar } from './NeedRatingBar';
import { NeedSheetHeader } from './NeedSheetHeader';
import { pressable } from '../utils/a11y';
import { CollapsibleSection } from './needToday/CollapsibleSection';
import {
  ExamplesBody,
  ReflectionBody,
  RangesBody,
} from './needToday/SectionBodies';

interface Props {
  need: Need;
  value: number;
  yesterdayValue?: number;
  onChange: (v: number) => void;
  onClose: () => void;
  onPlanSaved?: (needId: string) => void;
  onOpenHelp?: () => void;
}

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
  const [showPlan, setShowPlan] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [showRanges, setShowRanges] = useState(false);
  const NEED_DATA = useNeedData();
  const data = NEED_DATA[need.id];
  if (!data) return null;
  const color = COLORS[need.id] ?? '#888';

  const rangeIdx = value <= 3 ? 0 : value <= 6 ? 1 : 2;

  return (
    <BottomSheet onClose={onClose}>
      <NeedSheetHeader
        need={need}
        data={data}
        color={color}
        onClose={onClose}
      />

      {/* Section 5: Slider — at top for immediate access */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-4)',
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
          yesterday={yesterdayValue}
          onChange={onChange}
        />
      </div>

      {/* High score affirmation */}
      {rangeIdx === 2 && (
        <div
          style={{
            background: color + '18',
            border: `1px solid ${color}33`,
            borderRadius: 'var(--r-12)',
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color,
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Сегодня эта потребность получила заботу — заметь это',
            'Сегодня эта потребность получила заботу — заметьте это',
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

      {/* Как это выглядит в жизни */}
      <CollapsibleSection
        label="Как это выглядит в жизни"
        open={showExamples}
        onToggle={() => setShowExamples((v) => !v)}
      >
        <ExamplesBody data={data} color={color} />
      </CollapsibleSection>

      {data.reflection?.length > 0 && (
        <CollapsibleSection
          label="Вопросы для рефлексии"
          open={showReflection}
          onToggle={() => setShowReflection((v) => !v)}
        >
          <ReflectionBody data={data} color={color} />
        </CollapsibleSection>
      )}

      {/* Как понять оценку */}
      <CollapsibleSection
        label="Как понять оценку"
        open={showRanges}
        onToggle={() => setShowRanges((v) => !v)}
      >
        <RangesBody
          data={data}
          color={color}
          rangeIdx={rangeIdx}
          onChange={onChange}
        />
      </CollapsibleSection>

      {/* Plan button + Help link (low score only) */}
      {value <= 3 && (
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-8)',
          }}
        >
          <div
            {...pressable(() => setShowPlan(true))}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: color + '12',
              border: `1px solid ${color}28`,
              borderRadius: 'var(--r-12)',
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
              {...pressable(() => {
                onClose();
                onOpenHelp();
              })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background:
                  'color-mix(in srgb, var(--accent-red) 8%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)',
                borderRadius: 'var(--r-12)',
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
    </BottomSheet>
  );
}
