// Карточка «Мой портрет» — редизайн вкладки «Я»: горизонтальные бары по
// пяти доменам схем (макет утверждён барами, не кольцом), итог теста на
// схемы и дельта с прошлого прохождения. Данные — общий слой
// shared/src/portrait/portraitData.ts (правило №4, активность схем здесь не
// пересчитываем). Пустое состояние объясняет «откуда и зачем» (правило
// «Онбординг») вместо тишины/заглушки.
//
// Вся карточка кликабельна (правило «Онбординг»: одно очевидное действие) —
// тап открывает PortraitSheet с полными списками «Мои схемы»/«Мои режимы»
// (раньше жили отдельными карточками профиля). Внутренние CTA
// («Пройти тест», «Пройти тест на схемы →») — настоящие вложенные <button>
// с stopPropagation, чтобы не всплывать в открытие листа (no button-in-
// button: корень — div c role="button" через pressable, не сам <button>).
import type { CSSProperties, MouseEvent } from 'react';
import { useTr } from '../../utils/addressForm';
import { fmtDate, momentDayKey } from '../../utils/format';
import { pressable } from '../../utils/a11y';
import {
  portraitTexts,
  portraitTotalsText,
  portraitDeltaText,
} from '../../../../shared/src/portrait/portraitTexts';
import {
  hasPortraitData,
  type Portrait,
  type PortraitNeed,
} from '../../../../shared/src/portrait/portraitData';

interface Props {
  portrait: Portrait;
  ysqCompletedAt: string | null;
  onOpenPatterns: () => void;
  onOpenSheet: () => void;
}

function stopAnd(handler: () => void) {
  return (e: MouseEvent) => {
    e.stopPropagation();
    handler();
  };
}

const footBtn: CSSProperties = {
  width: '100%',
  padding: '10px 0',
  border: 'none',
  borderTop: '1px solid var(--border-color)',
  background: 'transparent',
  color: 'var(--text-sub)',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
};

// Экспортируется — PortraitNeedRows.tsx (лист «Мой портрет») рисует те же
// бары рядов потребностей поверх аккордеона (правило «одна механика — один
// компонент»: вид бара не копируется вторым файлом).
export function NeedBar({
  n,
  maxCount,
}: {
  n: PortraitNeed;
  maxCount: number;
}) {
  return (
    <div className="u-ac10">
      <div
        style={{
          width: 150,
          flexShrink: 0,
          fontSize: 13,
          color: 'var(--ink-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span aria-hidden>{n.emoji}</span>
        <span>{n.label}</span>
      </div>
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 'var(--r-4)',
          background: 'var(--progress-track)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 'var(--r-4)',
            width: `${(n.count / maxCount) * 100}%`,
            background: n.color,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div
        style={{
          width: 16,
          textAlign: 'right',
          fontSize: 12,
          fontWeight: 700,
          color: n.count > 0 ? 'var(--text)' : 'var(--text-faint)',
        }}
      >
        {n.count}
      </div>
    </div>
  );
}

export function PortraitCard({
  portrait,
  ysqCompletedAt,
  onOpenPatterns,
  onOpenSheet,
}: Props) {
  const tr = useTr();
  const hasData = hasPortraitData(portrait);
  const maxCount = Math.max(1, ...portrait.needs.map((n) => n.count));
  const delta = portrait.delta;
  const deltaText = portraitDeltaText(delta);
  const txt = portraitTexts(tr);

  return (
    <div
      {...pressable(onOpenSheet)}
      className="card"
      style={{
        borderRadius: 'var(--r-20)',
        padding: '16px 16px 18px',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
          gap: 'var(--space-8)',
        }}
      >
        <div className="d-caps">Мой портрет</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {hasData && (
            <div className="d-display" style={{ fontSize: 14 }}>
              {portraitTotalsText(portrait)}
            </div>
          )}
          <span
            aria-hidden
            style={{ color: 'var(--text-faint)', fontSize: 16 }}
          >
            ›
          </span>
        </div>
      </div>

      {/* Онбординг-объяснение «что это» в контексте — не в спрятанном About
          (правило «Онбординг и очевидность»): за каждым баром стоят активные
          схемы, сгруппированные по одной из пяти базовых потребностей. */}
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--text-faint)',
          marginBottom: 14,
          lineHeight: 1.4,
        }}
      >
        {txt.hint}
      </div>

      {!hasData && (
        <div>
          <div className="u-sub13-lh16">{txt.emptyCard}</div>
          <button
            onClick={stopAnd(onOpenPatterns)}
            style={{
              marginTop: 12,
              padding: '10px 16px',
              borderRadius: 'var(--r-12)',
              border: '1.5px dashed var(--border-color)',
              background: 'transparent',
              color: 'var(--text-sub)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {txt.takeTest}
          </button>
        </div>
      )}

      {hasData && (
        <div className="u-col10">
          {portrait.needs.map((n) => (
            <NeedBar key={n.id} n={n} maxCount={maxCount} />
          ))}
        </div>
      )}

      {hasData && ysqCompletedAt && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="u-faint11">
            Тест на схемы · {fmtDate(momentDayKey(ysqCompletedAt))}
          </span>
          {deltaText && delta != null && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 'var(--r-8)',
                ...(delta < 0
                  ? {
                      color: 'var(--accent-green)',
                      background:
                        'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                    }
                  : { color: 'var(--text-sub)', background: 'transparent' }),
              }}
            >
              {deltaText}
            </span>
          )}
        </div>
      )}

      {hasData && !ysqCompletedAt && (
        <button
          onClick={stopAnd(onOpenPatterns)}
          style={{ ...footBtn, marginTop: 14 }}
        >
          {txt.takeTestArrow}
        </button>
      )}
    </div>
  );
}
