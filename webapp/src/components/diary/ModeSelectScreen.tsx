import { useState } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { haptic } from '../../haptic';
import { ModeFeelingBrowse } from './ModeFeelingBrowse';
import { ModeGroupList } from './ModeGroupList';

/**
 * Шаг 1 дневника режимов (webapp): выбор режима.
 * Выбор = чипы «по ощущению» (9 семей, включая вход «не знаю, что
 * чувствую» — ModeFeelingBrowse) + свёрнутый полный список групп для тех,
 * кто знает точное название (ModeGroupList). Вынесено из ModeEntrySheet
 * (правило №10). Парный по смыслу с miniapp ModeSelectStep. listOpen — локален.
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
  const [listOpen, setListOpen] = useState(false);

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
            голоса в голове.{' '}
            {tr(
              'Замечай резкие переключения – это его след.',
              'Замечайте резкие переключения – это его след.',
            )}
          </p>
        </div>
      }
    >
      {/* Главное действие: выбор по ощущению */}
      <div style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: '0 0 10px' }}>
        {tr(
          'Что сейчас чувствуешь? Выбери самое близкое:',
          'Что сейчас чувствуете? Выберите самое близкое:',
        )}
      </div>
      <ModeFeelingBrowse onPick={onPick} />

      {/* Третичное: полный список для тех, кто знает режим */}
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

      {listOpen && <ModeGroupList modeId={modeId} onPick={onPick} />}
    </ExScreen>
  );
}
