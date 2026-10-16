import { useTr } from '../../utils/addressForm';

interface Action { busy: boolean; failed: boolean }

const CANVAS_HINT = 'Новая карта режимов из этой схемы: можно двигать фигуры, дописывать и рисовать связи';

// Панель над схемой случая: «Скачать картинкой», «На весь экран» и «Открыть на
// холсте». Холст только на сайте (карты режимов в мини-аппе нет), поэтому кнопка
// есть, лишь когда вкладке есть куда вести — canvas не передан, кнопки нет.
// «На весь экран» есть только в потоке (onFullscreen), в самом листе её нет.
// compact — шапка листа: без нижнего отступа и без пояснения к холсту (оно уходит
// в подсказку кнопки: лист открывают из потока, где пояснение уже было видно).
export function ConceptGraphToolbar({ image, canvas, onFullscreen, compact }: {
  image: Action & { download: () => void };
  canvas?: Action & { open: () => void };
  onFullscreen?: () => void;
  compact?: boolean;
}) {
  const tr = useTr();
  const alert = (text: string) => (
    <span role="alert" style={{ fontSize: 13, color: 'var(--err)' }}>{text}</span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)', marginBottom: compact ? 0 : 'var(--space-12)' }}>
      <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={image.download} disabled={image.busy}>
        {image.busy ? 'Готовлю картинку…' : '↓ Скачать картинкой'}
      </button>
      {image.failed && alert(tr('Не удалось сохранить картинку. Попробуй ещё раз.', 'Не удалось сохранить картинку. Попробуйте ещё раз.'))}
      {onFullscreen && (
        <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={onFullscreen} title="Схема на всё окно: на широком экране встаёт в четыре колонки">
          ⤢ На весь экран
        </button>
      )}
      {canvas && (
        <>
          <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={canvas.open} disabled={canvas.busy} title={compact ? CANVAS_HINT : undefined}>
            {canvas.busy ? 'Переношу на холст…' : 'Открыть на холсте'}
          </button>
          {!compact && <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{CANVAS_HINT}</span>}
          {canvas.failed && alert(tr('Не получилось перенести на холст. Попробуй ещё раз.', 'Не получилось перенести на холст. Попробуйте ещё раз.'))}
        </>
      )}
    </div>
  );
}
