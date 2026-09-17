// «Что поможет» — блок экрана паттерна между карточкой и записями дневника:
// чем можно помочь себе прямо сейчас. Контент уже выверен в других местах
// (голос Здорового Взрослого, совет по схеме, потребность) — здесь только
// склейка (patternHelpContent.ts) и три чипа быстрых практик, которые
// открывают тот же QuickPracticeSheet, что и «Помощь»/плюс-меню (правило
// «одна механика — один компонент»: второго пути открыть практику не заводим).
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { SectionLabel } from '../SectionLabel';
import { QuickPracticeSheet } from '../QuickPracticeSheet';
import { useTr, useAddressForm } from '../../utils/addressForm';
import { resolveModeHelp, resolveSchemaHelp } from './patternHelpContent';
import {
  QUICK_PRACTICE_IDS,
  buildQuickPractice,
  type QuickPracticeId,
} from '../../../../shared/src/practices/quickPractices';
import type { MyCardsKind } from '../myCards/useMyCards';

interface Props {
  kind: MyCardsKind;
  id: string;
}

const TIP_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-8)',
  background: 'rgba(var(--fg-rgb),0.05)',
  borderRadius: 'var(--r-10)',
  padding: '10px 12px',
  marginBottom: 10,
};

export function PatternHelpSection({ kind, id }: Props) {
  const tr = useTr();
  const form = useAddressForm();
  const [activePractice, setActivePractice] = useState<QuickPracticeId | null>(
    null,
  );

  if (activePractice)
    return (
      <QuickPracticeSheet
        id={activePractice}
        onClose={() => setActivePractice(null)}
      />
    );

  const mode = kind === 'mode' ? resolveModeHelp(id) : null;
  const schema = kind === 'schema' ? resolveSchemaHelp(id, form) : null;
  const needText =
    mode?.needText ??
    (schema?.needName && schema.needLine
      ? `${schema.needName} — ${schema.needLine}`
      : null);

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel>Что поможет</SectionLabel>

      {mode && (
        <div
          style={{
            background:
              'color-mix(in srgb, var(--accent-green) 8%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent-green) 22%, transparent)',
            borderRadius: 'var(--r-16)',
            padding: '14px 16px',
            marginBottom: 10,
            display: 'flex',
            gap: 'var(--space-10)',
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>🌿</span>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--accent-green)',
                marginBottom: 4,
              }}
            >
              Здоровый Взрослый отвечает
            </div>
            <div
              style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}
            >
              {mode.adultText}
            </div>
          </div>
        </div>
      )}

      {schema?.tip && (
        <div style={TIP_ROW_STYLE}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <span
            style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}
          >
            {schema.tip}
          </span>
        </div>
      )}

      {needText && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.03em',
              color: 'var(--text-faint)',
              marginBottom: 4,
            }}
          >
            Что на самом деле нужно
          </div>
          <div
            style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}
          >
            {needText}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
        {QUICK_PRACTICE_IDS.map((pid) => {
          const practice = buildQuickPractice(pid, tr);
          return (
            <button
              key={pid}
              onClick={() => setActivePractice(pid)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 'var(--r-20)',
                border: '1px solid var(--border-color)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <span>{practice.emoji}</span>
              {practice.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
