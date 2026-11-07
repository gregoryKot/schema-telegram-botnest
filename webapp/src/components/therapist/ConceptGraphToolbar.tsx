import { useTr } from '../../utils/addressForm';
import { CANVAS_HINT, type GraphActions } from './concept/conceptHeadText';

// Панель действий в шапке листа «На весь экран»: «Скачать картинкой» и «Открыть
// на холсте». В потоке те же действия лежат в меню «⋯ Ещё» шапки вкладки
// (ConceptTabHead), но лист закрывает шапку — здесь они стоят кнопками. Холст
// только на сайте (карт режимов в мини-аппе нет), поэтому кнопка есть, лишь когда
// вкладке есть куда вести — canvas не передан, кнопки нет. Пояснение к холсту —
// в подсказке кнопки: лист открывают из меню, где подсказка та же.
export function ConceptGraphToolbar({ image, canvas }: Pick<GraphActions, 'image' | 'canvas'>) {
  const tr = useTr();
  const alert = (text: string) => (
    <span role="alert" style={{ fontSize: 13, color: 'var(--err)' }}>{text}</span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)' }}>
      <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={image.download} disabled={image.busy}>
        {image.busy ? 'Готовлю картинку…' : '↓ Скачать картинкой'}
      </button>
      {image.failed && alert(tr('Не удалось сохранить картинку. Попробуй ещё раз.', 'Не удалось сохранить картинку. Попробуйте ещё раз.'))}
      {canvas && (
        <>
          <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={canvas.open} disabled={canvas.busy} title={CANVAS_HINT}>
            {canvas.busy ? 'Переношу на холст…' : 'Открыть на холсте'}
          </button>
          {canvas.failed && alert(tr('Не получилось перенести на холст. Попробуй ещё раз.', 'Не получилось перенести на холст. Попробуйте ещё раз.'))}
        </>
      )}
    </div>
  );
}
