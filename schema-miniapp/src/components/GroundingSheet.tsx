// Заземление 5-4-3-2-1 (экран «Здесь и сейчас», дизайн-макет; волна 2
// нейродизайна). Пошагово, по одному чувству за раз — без стены текста
// (прогрессивное раскрытие). Контент статичный, вилка ты/вы через tr.
import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { useTr } from '../utils/addressForm';

const buildSteps = (tr: (ty: string, vy: string) => string) => [
  {
    n: 5,
    emoji: '👀',
    title: tr(
      'Найди 5 вещей, которые видишь',
      'Найдите 5 вещей, которые видите',
    ),
    hint: 'Любые предметы вокруг. Не спеша, по одному.',
  },
  {
    n: 4,
    emoji: '✋',
    title: tr('Потрогай 4 предмета рядом', 'Потрогайте 4 предмета рядом'),
    hint: 'Стол, ткань, кружка. Какие они на ощупь — тёплые, шершавые?',
  },
  {
    n: 3,
    emoji: '👂',
    title: tr('Услышь 3 звука', 'Услышьте 3 звука'),
    hint: 'Шум за окном, собственное дыхание, гул техники.',
  },
  {
    n: 2,
    emoji: '👃',
    title: tr('Заметь 2 запаха', 'Заметьте 2 запаха'),
    hint: 'Кожа, одежда, воздух в комнате. Любые, даже едва заметные.',
  },
  {
    n: 1,
    emoji: '👅',
    title: tr('Ощути 1 вкус', 'Ощутите 1 вкус'),
    hint: 'Глоток воды или чая. Или просто вкус во рту сейчас.',
  },
];

export function GroundingSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const steps = buildSteps(tr);
  const [step, setStep] = useState(0);
  const done = step >= steps.length;
  const cur = steps[Math.min(step, steps.length - 1)];

  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div style={{ paddingTop: 4, textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
          Заземление 5-4-3-2-1
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          Пять чувств по очереди — способ вернуться в тело и в комнату
        </div>

        {done ? (
          <div style={{ padding: '28px 0 8px' }}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>🌿</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: 12,
              }}
            >
              {tr('Ты здесь. Всё на месте', 'Вы здесь. Всё на месте')}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              Можно повторить круг — или просто побыть тут ещё немного.
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px 0 8px' }}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>{cur.emoji}</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: 12,
                lineHeight: 1.35,
              }}
            >
              {cur.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              {cur.hint}
            </div>
          </div>
        )}

        {/* Точки прогресса */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
            margin: '14px 0 16px',
          }}
        >
          {steps.map((s, i) => (
            <div
              key={s.n}
              style={{
                width: i === step ? 18 : 7,
                height: 7,
                borderRadius: 4,
                background:
                  i < step
                    ? 'var(--accent-green)'
                    : i === step
                      ? 'var(--accent)'
                      : 'rgba(var(--fg-rgb),0.12)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '13px 18px',
              borderRadius: 12,
              border: 'none',
              background: 'rgba(var(--fg-rgb),0.06)',
              color: 'var(--text-sub)',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Закрыть
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={() => (done ? setStep(0) : setStep((s) => s + 1))}
          >
            {done
              ? 'Ещё круг'
              : step === steps.length - 1
                ? 'Готово'
                : 'Дальше'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
