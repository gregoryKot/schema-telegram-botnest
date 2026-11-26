import { useId, type ReactNode } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useDialogA11y } from '../../../../shared/src/utils/dialogA11y';

/**
 * Подэкран настроек (время, пояс, частота, тихие часы) — свой уровень поверх главного вида листа:
 * запись истории и слой Escape (useHistorySheet — «Назад» браузера и Escape возвращают на главный
 * вид, а не закрывают лист), фокус на «← Назад» и Tab внутри (useDialogA11y). Все выходы — через
 * `done` (тот же goBack): кнопка, выбор варианта. Пустая колонка оглавления держит место: на ≥1024
 * подэкран стоит в той же колонке, что главный вид, а не прыгает к сайдбару.
 */
export function SettingsSubScreen({ title, badge, onClose, children }: {
  title: string;
  /** Статус сохранения — тот же, что в шапке главного вида. */
  badge: ReactNode;
  onClose: () => void;
  children: (done: () => void) => ReactNode;
}) {
  const goBack = useHistorySheet(onClose);
  const a11y = useDialogA11y();
  const titleId = useId();
  const done = () => goBack();
  return (
    <div {...a11y} className="st-level" aria-labelledby={titleId}>
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={done}>← Назад</button>
        {badge}
      </div>
      <div className="st-body">
        <div className="settings-sidenav" aria-hidden="true" />
        <div className="st-scroll">
          <div className="settings-content-inner st-inner st-inner--sub">
            <h2 id={titleId} className="ds-h2 st-h">{title}</h2>
            {children(done)}
          </div>
        </div>
      </div>
    </div>
  );
}
