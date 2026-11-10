import { ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';
import { ScenePebbleLaid, Sprout } from '../../art/AppScenes';
import { CrisisCard } from '../../CrisisCard';
import { DoneSheet } from '../../paper/DoneSheet';
import { TherapyLine } from '../../therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../../therapy/useTherapyBridgeTexts';
import type { QuickSaved } from './quickEntryModel';
import { quickDoneView } from './quickDoneView';

/**
 * Экран после сохранения — «лист готово» (DoneSheet) по типу записи: мысль — камешек лёг на лист,
 * схема — росток с Layers, режим — росток со знаком его группы, благодарность — камешки по пунктам
 * дня. Кризисная карточка — отдельным листом над «готово» (выравнивание влево: по центру строка
 * «детям, подросткам и родителям» рвалась на 390). Строка моста — под листом, тише кнопок.
 */
export function QuickDone({ saved, crisis, onHome, onAgain }: {
  saved: QuickSaved;
  crisis: boolean;
  onHome: () => void;
  onAgain: () => void;
}) {
  const bridge = useTherapyBridgeTexts();
  const view = quickDoneView(saved);
  const scene = view.sprout ? <Sprout sign={view.sprout} hue={view.hue} />
    : view.pebbles !== undefined ? <ScenePebbleLaid hue={ENTITY_LOOK.gratitude.hue} filled={view.pebbles} /> : undefined;
  return (
    <div className="tq-body qe-done-body">
      <div className="qe-done">
        <DoneSheet
          entity={view.entity}
          hue={view.hue}
          scene={scene}
          crisis={crisis ? <CrisisCard surface="schema" /> : undefined}
          label="Дневник"
          title="Записано"
          sub="Теперь это есть в записях"
          primary={{ label: 'На главную', onClick: onHome }}
          secondary={{ label: 'Ещё одну', onClick: onAgain }}
          titleAs="h1"
        />
        <TherapyLine place="diary_done" text={bridge.lineDiary} className="qe-done-line" />
      </div>
    </div>
  );
}
