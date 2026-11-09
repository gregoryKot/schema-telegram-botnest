import { useHistorySheet } from '../hooks/useHistorySheet';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { useQuietFocus } from '../hooks/useQuietFocus';
import { BrandMark } from './art/BrandMark';
import { WhyThree } from './why/WhyThree';
import { WhyLegend } from './why/WhyLegend';
import { glue } from '../../../shared/src/utils/typo';
import { TherapyLine } from './therapy/TherapyLine';
import { useTherapyBridgeTexts } from './therapy/useTherapyBridgeTexts';
import '../styles/client-why.css';

// auto: true — лист открылся сам при первом входе; false — по кнопке «Зачем это?» или из «Ещё»
interface Props { auto?: boolean; onClose: () => void }

// «Зачем это всё» — «откуда это и зачем» на пути (frontend-visual.md): знак продукта, три листа оттенков и знаков
// квадратов главной, легенда сеткой; «Понятно, начнём» на телефоне прилипает к низу (М4), на компьютере — за листами.
export function WhySheet({ auto = false, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const bridge = useTherapyBridgeTexts();
  const dialogA11y = useDialogA11y(); // фокус на «← Закрыть», Tab внутри, возврат к вызвавшей строке
  const quietFocus = useQuietFocus(); // открылся сам или касанием — без кольца до первой клавиши перехода
  return (
    <div {...dialogA11y} {...quietFocus} className="u-sheet cw-sheet cw-why" aria-label="Зачем это всё">
      <div className="ds-sheet-head ds-sheet-head--page cw-head"><button type="button" className="ds-back" onClick={goBack}>← Закрыть</button></div>
      <div className="cw-inner">
        <header className="cw-why-head">
          <div className="ds-eyebrow">{auto ? 'Первый раз здесь' : 'Зачем это всё'}</div>
          <span className="pp-paper cw-why-mark" aria-hidden="true"><BrandMark size={64} /></span>
          <h1 className="ds-h1">Три вещи, которые здесь можно делать</h1>
          <p className="cw-lead">{glue('Всё строится на схема-терапии: у человека есть пять базовых потребностей — привязанность, '
            + 'автономия, выражение чувств, спонтанность, границы. Когда их долго не хватает, включаются старые паттерны. '
            + 'Приложение помогает это замечать.')}</p>
        </header>
        <WhyThree />
        <WhyLegend />
        <p className="cw-tip">Не нужно делать всё. Одно действие в день — уже работа.</p>
        <div className="cw-sticky"><button type="button" className="ds-btn ds-btn--lg" onClick={goBack}>Понятно, начнём</button></div>
        <TherapyLine place="why" text={bridge.lineHome} className="cw-foot" />
      </div>
    </div>
  );
}
