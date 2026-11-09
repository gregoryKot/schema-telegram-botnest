import { useHistorySheet } from '../hooks/useHistorySheet';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { WhyActions, WhyHero } from './why/WhyActions';
import { WhyLegend } from './why/WhyLegend';
import { TherapyLine } from './therapy/TherapyLine';
import { useTherapyBridgeTexts } from './therapy/useTherapyBridgeTexts';
import '../styles/client-why.css';

// auto: true — лист открылся сам при первом входе; false — по кнопке «Зачем это?» или из «Ещё»
interface Props { auto?: boolean; onClose: () => void }

// «Зачем это всё»: откуда взялись три действия и что даёт каждое — «откуда это и зачем» на пути
// пользователя (frontend-visual.md). Шапка листа с «← Закрыть» (ds-sheet-head, #906); «Понятно, начнём»
// идёт после строк; на телефоне прилипает к низу листа: на 390×664 и 360×640 она была за краем (QA мобильной, М4).
export function WhySheet({ auto = false, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const bridge = useTherapyBridgeTexts();
  const dialogA11y = useDialogA11y(); // фокус на «← Закрыть», Tab внутри, возврат к вызвавшей строке
  return (
    <div {...dialogA11y} className="u-sheet cw-sheet" aria-label="Зачем это всё">
      <div className="ds-sheet-head ds-sheet-head--page cw-head">
        <button type="button" className="ds-back" onClick={goBack}>← Закрыть</button>
      </div>
      <div className="cw-inner">
        <WhyHero />
        <header>
          <div className="ds-eyebrow">{auto ? 'Первый раз здесь' : 'Зачем это всё'}</div>
          <h1 className="ds-h1">Три вещи, которые здесь можно делать</h1>
        </header>
        <p className="cw-lead">
          Всё строится на схема-терапии: у человека есть пять базовых потребностей — привязанность, автономия, выражение чувств,
          спонтанность, границы. Когда их долго не хватает, включаются старые паттерны. Приложение помогает это замечать.
        </p>
        <WhyActions />
        <WhyLegend />
        <p className="cw-tip">Не нужно делать всё. Одно действие в день — уже работа.</p>
        <div className="cw-sticky"><button type="button" className="ds-btn ds-btn--lg" onClick={goBack}>Понятно, начнём</button></div>
        <TherapyLine place="why" text={bridge.lineHome} className="cw-foot" />
      </div>
    </div>
  );
}
