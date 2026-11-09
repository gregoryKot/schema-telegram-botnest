// Шапка окон первого входа (редизайн 2026-11, docs/design/APP_2026-11.md, раздел b06-entry): лист
// цветной бумаги во всю ширину окна сверху — надпись, заголовок Literata и знак сущности в углу,
// как лист-герой потока (EntitySheet — он и рисует лист, здесь только место в окне). Один каркас на
// выбор формы обращения, три шага согласий, приглашения терапевта и пары, «Поддержать проект»: приветствие —
// персик и компактный коллаж первого экрана лендинга, конфиденциальность — небо и Limits, «не
// терапия» — шалфей и Check, терапевт — Talk, пара — NeedArt attachment, исходы — OUTCOME_LOOK.
//  • scene — сцена во всю ширину над надписью (коллаж приветствия): знак в углу её бы сжал;
//  • sticker — наклейка на сцене (бета): текст, а не декор — сцена скрыта от чтения, наклейка нет;
//  • без надписи заголовок на узком листе встаёт рядом со знаком (ef-bare), а не под ним:
//    иначе слева от знака оставалась пустая строка высотой в знак.
// Окно (Dialog) отдаёт шапке свои поля: entry-flows.css — `.sk-dialog-box:has(> .ef-head)`.
import type { ReactNode } from 'react';
import type { EntityId, PaperHue, SheetLook } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { BrandMark } from '../art/BrandMark';
import { EntitySheet } from './EntitySheet';
import '../../styles/entry-flows.css';

export interface EntryHeadProps {
  look: EntityId | SheetLook;
  label?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** Своя картинка в углу листа вместо знака сущности (знак продукта). */
  art?: ReactNode;
  /** Сцена во всю ширину над надписью; лист под ней — той же бумаги `hue`. */
  scene?: { art: ReactNode; hue: PaperHue; sticker?: ReactNode };
}

export function EntryHead({ look, label, title, sub, art, scene }: EntryHeadProps) {
  const sheetLook = scene ? { hue: scene.hue } : look;
  const cls = `ef-head-sheet ef-art${label ? '' : ' ef-bare'}`;
  return (
    <div className="ef-head">
      {scene && (
        <div className="pp-paper ef-head-scene" style={hueStyle(scene.hue)}>
          <div className="ef-head-scene-art" aria-hidden="true">{scene.art}</div>
          {scene.sticker && <span className="ef-sticker">{scene.sticker}</span>}
        </div>
      )}
      <EntitySheet look={sheetLook} label={label} title={title} sub={sub} art={art} className={cls} />
    </div>
  );
}

/** Шаги потока бумажками их оттенков: пройденные и текущий — бумага шага, впереди — бледные.
 *  Декор при надписи «Шаг 1 из 3» — номер читает она. */
export function EntrySteps({ hues, at }: { hues: readonly PaperHue[]; at: number }) {
  return (
    <span className="ef-steps" aria-hidden="true">
      {hues.map((h, i) => (
        <i key={h} className={i < at ? 'is-done' : i === at ? 'is-on' : undefined} style={hueStyle(h)} />
      ))}
    </span>
  );
}

/** Знак продукта плиткой на бумаге — как значок приложения, с тенью-вырезкой тоном листа. */
export function EntryBrand() {
  return <span className="ef-brand"><BrandMark size={64} /></span>;
}
