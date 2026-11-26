import { ExBar } from '../exercises/ExBar';
import { DoneSheet } from '../paper/DoneSheet';
import { SignArt } from '../art/SignArt';
import { TherapyLine } from '../therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../therapy/useTherapyBridgeTexts';
import { CaseNeedBridge } from './CaseNeedBridge';
import { CaseSupportBlock } from './CaseSupportFoot';
import { SteadyArt } from './CaseSteadyStep';
import { api } from '../../api';
import '../../styles/case-quick.css';
/**
 * «Записано»: итог потока — «лист готово» (DoneSheet) на шалфее «Что случилось» со сценой сущности
 * (лента с петлёй «что задело» и ростком; ровный день — ровные полоски, как на его шаге: в спокойный
 * день ничего не задело), имя режима заголовком. Главное действие — «Посмотреть на карте себя»: запись
 * ложится туда; режим уже встречался за две недели (caseRepeat) — об этом прямо, «На главную» тихой ссылкой.
 * Рамка — бар ExScreen без шапки. Выбрана потребность — мост «в трекере» (CaseNeedBridge). Карточка поддержки
 * (правило №7): при кризисе встаёт над листом, иначе ниже остаётся «Тяжело прямо сейчас →».
 */
export function CaseDoneScreen({ name, steady, repeat = 1, needId = '', onOpenTracker, onOpenMap, onClose, crisis, onHardNow }: {
  name: string; steady?: boolean; needId?: string; onOpenTracker?: (needId: string) => void;
  /** Какая это встреча режима за окно caseRepeat, включая только что сохранённую. */
  repeat?: number;
  onOpenMap: () => void; onClose: () => void;
  crisis: boolean; onHardNow: () => void;
}) {
  const bridge = useTherapyBridgeTexts();
  const openMap = () => { api.trackEvent('case_map_opened', { repeat: repeat >= 2 }); onOpenMap(); };
  // Порог карты: повтор виден со второй встречи (caseNextStep: count >= 2).
  const sub = repeat >= 2
    ? `${name} — уже ${repeat}-й раз за две недели. На карте видно, что ещё повторяется рядом.`
    : 'Теперь это есть в записях и на карте себя. Встретится второй раз — станет видно, что повторяется.';
  const support = <CaseSupportBlock crisis={crisis} onHardNow={onHardNow} />;
  return (
    <div className="ex2-screen">
      <ExBar onBack={onClose} label="Закрыть" sticky />
      <div className="ex2-body ex2-body--single cq-done-body">
        <div className="ex2-main">
          <DoneSheet
            entity="case" titleAs="h1" label="Записано" title={name} scene={steady ? <SteadyArt className="cq-steady-done" /> : undefined}
            sub={sub}
            primary={{ label: <span className="cq-map-link"><SignArt sign="cluster" size="nav" />Посмотреть на карте себя</span>, onClick: openMap }}
            secondary={{ label: 'На главную', onClick: onClose }}
            crisis={crisis ? support : undefined}
          />
          <CaseNeedBridge needId={needId} onOpenTracker={onOpenTracker} />
          {!crisis && <div className="cq-done-support">{support}</div>}
          <TherapyLine place="case_done" text={bridge.lineCase} className="cq-done-therapy" />
        </div>
      </div>
    </div>
  );
}
