import { useHistorySheet } from '../hooks/useHistorySheet';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { BrandMark } from './art/BrandMark';
import { WhyThree } from './why/WhyThree';
import { WhyLegend } from './why/WhyLegend';
import { TherapyLine } from './therapy/TherapyLine';
import { useTherapyBridgeTexts } from './therapy/useTherapyBridgeTexts';
import '../styles/client-why.css';

// auto: true — лист открылся сам при первом входе; false — по кнопке «Зачем это?» или из «Ещё»
interface Props { auto?: boolean; onClose: () => void }

// «Зачем это всё»: откуда взялись три действия и что даёт каждое — «откуда это и зачем» на пути пользователя
// (frontend-visual.md). Рассказ о продукте — знак продукта в шапке; три действия — листы бумаги тех же
// оттенков и знаков, что квадраты главной; легенда знаков — сеткой. «Понятно, начнём» на телефоне прилипает
// к низу листа (QA мобильной, М4), на компьютере встаёт сразу за листами (client-why.css).
export function WhySheet({ auto = false, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const bridge = useTherapyBridgeTexts();
  const dialogA11y = useDialogA11y(); // фокус на «← Закрыть», Tab внутри, возврат к вызвавшей строке
  return (
    <div {...dialogA11y} className="u-sheet cw-sheet cw-why" aria-label="Зачем это всё">
      <div className="ds-sheet-head ds-sheet-head--page cw-head"><button type="button" className="ds-back" onClick={goBack}>← Закрыть</button></div>
      <div className="cw-inner">
        <header className="cw-why-head">
          <div className="ds-eyebrow">{auto ? 'Первый раз здесь' : 'Зачем это всё'}</div>
          <span className="pp-paper cw-why-mark" aria-hidden="true"><BrandMark size={64} /></span>
          <h1 className="ds-h1">Три вещи, которые здесь можно делать</h1>
          <p className="cw-lead">
            Всё строится на схема-терапии: у человека есть пять базовых потребностей — привязанность, автономия, выражение чувств,
            спонтанность, границы. Когда их долго не хватает, включаются старые паттерны. Приложение помогает это замечать.
          </p>
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
