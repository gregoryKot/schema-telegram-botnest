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
import { fmtDate } from '../../utils/format';
import { pressable } from '../../utils/a11y';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          borderRadius: 4,
          background: 'var(--progress-track)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 4,
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

  return (
    <div
      {...pressable(onOpenSheet)}
      className="card"
      style={{ borderRadius: 20, padding: '16px 16px 18px', cursor: 'pointer' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
          gap: 8,
        }}
      >
        <div className="d-caps">Мой портрет</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {hasData && (
            <div className="d-display" style={{ fontSize: 14 }}>
              {portrait.totalSchemas}{' '}
              {pluralRu(portrait.totalSchemas, 'схема', 'схемы', 'схем')} ·{' '}
              {portrait.totalModes}{' '}
              {pluralRu(portrait.totalModes, 'режим', 'режима', 'режимов')}
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
        {tr(
          'Сколько твоих активных схем стоит за каждой из пяти потребностей',
          'Сколько ваших активных схем стоит за каждой из пяти потребностей',
        )}
      </div>

      {!hasData && (
        <div>
          <div
            style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}
          >
            {tr(
              'Здесь соберётся твой портрет: какие схемы и режимы активны. Основа — тест на схемы и твои отметки.',
              'Здесь соберётся ваш портрет: какие схемы и режимы активны. Основа — тест на схемы и ваши отметки.',
            )}
          </div>
          <button
            onClick={stopAnd(onOpenPatterns)}
            style={{
              marginTop: 12,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1.5px dashed var(--border-color)',
              background: 'transparent',
              color: 'var(--text-sub)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Пройти тест
          </button>
        </div>
      )}

      {hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            Тест на схемы · {fmtDate(ysqCompletedAt.slice(0, 10))}
          </span>
          {delta != null && delta !== 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 8,
                ...(delta < 0
                  ? {
                      color: 'var(--accent-green)',
                      background:
                        'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                    }
                  : { color: 'var(--text-sub)', background: 'transparent' }),
              }}
            >
              {delta < 0 ? delta : `+${delta}`} с прошлого теста
            </span>
          )}
        </div>
      )}

      {hasData && !ysqCompletedAt && (
        <button
          onClick={stopAnd(onOpenPatterns)}
          style={{ ...footBtn, marginTop: 14 }}
        >
          Пройти тест на схемы →
        </button>
      )}
    </div>
  );
}
