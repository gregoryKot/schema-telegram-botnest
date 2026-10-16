import { useTr } from '../../utils/addressForm';

interface Action { busy: boolean; failed: boolean }

// Панель над схемой случая: «Скачать картинкой» и «Открыть на холсте». Холст
// только на сайте (карты режимов в мини-аппе нет), поэтому кнопка есть, лишь
// когда вкладке есть куда вести — canvas не передан, кнопки нет.
export function ConceptGraphToolbar({ image, canvas }: {
  image: Action & { download: () => void };
  canvas?: Action & { open: () => void };
}) {
  const tr = useTr();
  const alert = (text: string) => (
    <span role="alert" style={{ fontSize: 13, color: 'var(--err)' }}>{text}</span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)', marginBottom: 'var(--space-12)' }}>
      <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={image.download} disabled={image.busy}>
        {image.busy ? 'Готовлю картинку…' : '↓ Скачать картинкой'}
      </button>
      {image.failed && alert(tr('Не удалось сохранить картинку. Попробуй ещё раз.', 'Не удалось сохранить картинку. Попробуйте ещё раз.'))}
      {canvas && (
        <>
          <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={canvas.open} disabled={canvas.busy}>
            {canvas.busy ? 'Переношу на холст…' : 'Открыть на холсте'}
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            Новая карта режимов из этой схемы: можно двигать фигуры, дописывать и рисовать связи
          </span>
          {canvas.failed && alert(tr('Не получилось перенести на холст. Попробуй ещё раз.', 'Не получилось перенести на холст. Попробуйте ещё раз.'))}
        </>
      )}
    </div>
  );
}
