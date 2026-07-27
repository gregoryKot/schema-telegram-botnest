import { useState } from 'react';
import { ExScreen, GlyphCheck } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { haptic } from '../../haptic';
import { ModeTestScreen } from './ModeTestScreen';

/**
 * Шаг 1 дневника режимов (webapp): выбор режима.
 * Тест-первым («не знаю какой → определим по чувству») + свёрнутый список.
 * Вынесено из ModeEntrySheet (правило №10). Парный по смыслу с miniapp
 * ModeSelectStep. testOpen/listOpen — локальны.
 */
export function ModeSelectScreen({
  modeId,
  onPick,
  onBack,
}: {
  modeId: string;
  onPick: (id: string) => void;
  onBack: () => void;
}) {
  const tr = useTr();
  const [testOpen, setTestOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  if (testOpen) {
    return <ModeTestScreen onPick={onPick} onBack={() => setTestOpen(false)} />;
  }

  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад к дневнику"
      eyebrow="Дневник режимов · новая запись"
      eyebrowColor="var(--c-slate)"
      title={
        <>
          Кто сейчас
          <br />
          <span className="it">взял управление?</span>
        </>
      }
      lede={tr(
        'Режим – состояние, которое сейчас «за рулём». Не знаешь названия – определим по чувству, в пару тапов.',
        'Режим – состояние, которое сейчас «за рулём». Не знаете названия – определим по чувству, в пару тапов.',
      )}
      aside={
        <div
          className="aside-card"
          style={{
            borderColor: 'var(--c-slate)40',
            background: 'var(--c-slate)08',
          }}
        >
          <div
            className="aside-card-eyebrow"
            style={{ color: 'var(--c-slate)' }}
          >
            Подсказка
          </div>
          <h3>Как его узнать</h3>
          <p className="body">
            Режим узнаётся не по мыслям, а по тому, как меняется тело и тон
            голоса в голове. Замечай резкие переключения – это его след.
          </p>
        </div>
      }
    >
      {/* Главное действие: тест по чувству */}
      <button
        type="button"
        className="mode-test-cta"
        onClick={() => {
          haptic.select();
          setTestOpen(true);
        }}
      >
        <span className="mode-test-cta-emoji">🧭</span>
        <span className="mode-test-cta-text">
          <span className="mode-test-cta-title">
            {tr('Не знаешь, какой режим?', 'Не знаете, какой режим?')}
          </span>
          <span className="mode-test-cta-sub">
            Определим по чувству – пара тапов
          </span>
        </span>
      </button>

      {/* Вторичное: полный список для тех, кто знает режим */}
      <button
        type="button"
        className="ex-btn ex-btn-ghost mode-list-toggle"
        onClick={() => {
          haptic.tap();
          setListOpen((v) => !v);
        }}
      >
        {listOpen ? 'Скрыть список' : 'Знаю режим – выбрать из списка'}
      </button>

      {listOpen &&
        MODE_GROUPS.map((g) => (
          <div key={g.id} style={{ marginBottom: 28 }}>
            <div className="chip-section-eyebrow" style={{ color: g.color }}>
              <span className="dot" style={{ background: g.color }} />
              {g.group}
            </div>
            {g.items.map((m) => (
              <div
                key={m.id}
                className={
                  'mode-card ' + (modeId === m.id ? 'is-selected' : '')
                }
                style={{ '--mode-color': g.color } as React.CSSProperties}
                {...pressable(() => onPick(m.id))}
              >
                <span className="mode-card-stripe" />
                <div>
                  <div className="mode-card-name">{m.name}</div>
                  <div className="mode-card-short">{m.short}</div>
                </div>
                <span className="mode-check">
                  <GlyphCheck />
                </span>
              </div>
            ))}
          </div>
        ))}
    </ExScreen>
  );
}
