import { ExBar } from '../exercises/ExBar';
import { DoneSheet } from '../paper/DoneSheet';
import { SignArt } from '../art/SignArt';
import { TherapyLine } from '../therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../therapy/useTherapyBridgeTexts';
import { CaseSupportBlock } from './CaseSupportFoot';
import '../../styles/case-quick.css';

/**
 * «Записано»: итог потока — «лист готово» (DoneSheet) на шалфее «Что случилось» со сценой
 * сущности (лента с ростком), имя режима заголовком, «Карта себя» тихой ссылкой со знаком.
 * Рамка — бар ExScreen без шапки: заголовок несёт сам лист. Карточка поддержки (правило №7):
 * кризисный текст из разбора после сохранения никуда не делся — карточка встаёт над листом;
 * без кризиса ниже листа остаётся «Тяжело прямо сейчас →».
 */
export function CaseDoneScreen({ name, onOpenMap, onClose, crisis, onHardNow }: {
  name: string;
  onOpenMap: () => void;
  onClose: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const bridge = useTherapyBridgeTexts();
  const support = <CaseSupportBlock crisis={crisis} onHardNow={onHardNow} />;
  return (
    <div className="ex2-screen">
      <ExBar onBack={onClose} label="Закрыть" sticky />
      <div className="ex2-body ex2-body--single cq-done-body">
        <div className="ex2-main">
          <DoneSheet
            entity="case" titleAs="h1" label="Записано" title={name}
            sub="Теперь это есть в записях. Через 2–3 разбора видно, что повторяется."
            primary={{ label: 'На главную', onClick: onClose }}
            secondary={{ label: <span className="cq-map-link"><SignArt sign="cluster" size="nav" />Карта себя</span>, onClick: onOpenMap }}
            crisis={crisis ? support : undefined}
          />
          {!crisis && <div className="cq-done-support">{support}</div>}
          <TherapyLine place="case_done" text={bridge.lineCase} className="cq-done-therapy" />
        </div>
      </div>
    </div>
  );
}
