import { useState } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { DIARY_HUE } from '../../lib/tone';
import { DiaryAside } from './DiaryStepCard';
import { haptic } from '../../haptic';
import { ModeFeelingBrowse } from './ModeFeelingBrowse';
import { ModeGroupList } from './ModeGroupList';
import { CrisisCard } from '../CrisisCard';

/**
 * Шаг 1 дневника режимов (webapp): выбор режима.
 * Выбор = чипы «по ощущению» (9 семей, включая вход «не знаю, что
 * чувствую» — ModeFeelingBrowse) + свёрнутый полный список групп для тех,
 * кто знает точное название (ModeGroupList). Герой — лист неба режимов с Cluster
 * (ENTITY_LOOK.diary_mode), на ≥1024 разворотом слева вместе с подсказкой.
 */
export function ModeSelectScreen({ modeId, onPick, onBack, crisis = false }: {
  modeId: string;
  onPick: (id: string) => void;
  onBack: () => void;
  crisis?: boolean;
}) {
  const tr = useTr();
  const [listOpen, setListOpen] = useState(false);

  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад к дневнику"
      look="diary_mode"
      spread
      eyebrow="Дневник режимов · новая запись"
      title="Кто сейчас взял управление?"
      lede={tr(
        'Режим – состояние, которое сейчас «за рулём». Не знаешь названия – определим по чувству, в пару тапов.',
        'Режим – состояние, которое сейчас «за рулём». Не знаете названия – определим по чувству, в пару тапов.',
      )}
      aside={
        <DiaryAside hue={DIARY_HUE.mode} eyebrow="Подсказка" title="Как его узнать"
          text={'Режим узнаётся не по мыслям, а по тому, как меняется тело и тон голоса в голове. ' + tr(
            'Замечай резкие переключения – это его след.',
            'Замечайте резкие переключения – это его след.',
          )} />
      }
    >
      {crisis && <CrisisCard surface="schema" />}
      {/* Главное действие: выбор по ощущению */}
      <div className="sd-select-q">
        {tr(
          'Что сейчас чувствуешь? Выбери самое близкое:',
          'Что сейчас чувствуете? Выберите самое близкое:',
        )}
      </div>
      <ModeFeelingBrowse onPick={onPick} />

      {/* Третичное: полный список для тех, кто знает режим */}
      <button
        type="button"
        className="ds-btn ds-btn--secondary sd-list-toggle"
        aria-expanded={listOpen}
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
