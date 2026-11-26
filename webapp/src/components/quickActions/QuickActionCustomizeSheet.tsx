// Лист «что показывать»: тумблер и ручка «≡» на каждое действие, как в
// мини-аппе. Один на две поверхности — «плюс» и «Инструменты» (surface).
// Хранение, ключи и аналитика — общие (shared/src/quickActions), строка листа —
// та же CustomizeRow, что у «Настроить экран». Группа с fixedOrder — только
// тумблеры, без ручки «≡» (порядок этих пунктов на странице не меняется).
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { makeQuickActionRowHandlers } from '../../../../shared/src/quickActions/quickActionRowHandlers';
import { withDragRange } from '../../../../shared/src/quickActions/quickActionOrder';
import { useQuickActionDragRows } from '../../../../shared/src/quickActions/useQuickActionDragRows';
import type { QuickActionSurface } from '../../../../shared/src/quickActions/quickActionPrefs';
import { CustomizeRow } from '../customize/CustomizeRow';
import { CustomizeSheetFrame } from '../customize/CustomizeSheetFrame';
import { ReorderHint } from '../customize/ReorderHint';
import { glue } from '../../../../shared/src/utils/typo';

export interface SheetGroup {
  id: string;
  title: string;
  /** Пояснение под заголовком группы. */
  note?: string;
  fixedOrder?: boolean;
  actions: { id: string; label: string; sub: string; sign?: Parameters<typeof CustomizeRow>[0]['sign'] }[];
}

interface Props {
  groups: SheetGroup[];
  surface?: QuickActionSurface;
  title?: string;
  subtitle?: string;
  reorderNoun?: string;
  hidden: string[];
  onToggle: (id: string, hidden: boolean) => void;
  onReorder: (id: string, toIndex: number) => 'up' | 'down' | false;
  onClose: () => void;
}

export function QuickActionCustomizeSheet({
  groups, surface = 'plus', title = 'Что показывать в «+»', subtitle = 'Скрытые пункты можно вернуть в любой момент', reorderNoun = 'пунктов',
  hidden, onToggle, onReorder, onClose,
}: Props) {
  const tr = useTr();
  const handlers = makeQuickActionRowHandlers(surface, onToggle, onReorder, api);
  const flat = withDragRange(groups.map((g) => g.actions));
  const { rowProps } = useQuickActionDragRows(flat, handlers.handleReorder);
  const sections = groups.map((g, i) => {
    const start = groups.slice(0, i).reduce((n, prev) => n + prev.actions.length, 0);
    return { id: g.id, title: g.title, note: g.note, fixedOrder: g.fixedOrder, items: flat.slice(start, start + g.actions.length) };
  });
  return (
    <CustomizeSheetFrame title={title} subtitle={subtitle} onClose={onClose}>
      {() => (
        <>
          <ReorderHint tr={tr} phone noun={reorderNoun} />
          {sections.map((g) => (
            <div key={g.id}>
              <div className="ds-label cz-group">{g.title}</div>
              {g.note && <div className="ds-sub cz-hint">{glue(g.note)}</div>}
              <div className={g.fixedOrder && sections.some((o) => !o.fixedOrder) ? 'cz-card cz-card--slot' : 'cz-card'}>
                {g.items.map((a) => {
                  const wasHidden = hidden.includes(a.id);
                  const { dragHandleProps, rowRef, drag } = rowProps(a);
                  return (
                    <CustomizeRow
                      key={a.id} title={a.label}
                      sub={a.sub} sign={a.sign}
                      on={!wasHidden}
                      onToggle={() => handlers.handleToggle(a.id, wasHidden)}
                      handle={g.fixedOrder ? undefined : dragHandleProps}
                      rowRef={rowRef}
                      offsetY={drag.offsetY}
                      lifted={drag.lifted}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </CustomizeSheetFrame>
  );
}
