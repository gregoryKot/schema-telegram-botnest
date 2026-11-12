// «Живая бумага» концептуализации (редизайн 2026-11, b32/b33): знаки, чип и
// группа приходят с сайта контекстом — shared не импортирует webapp, а вид
// обязан совпадать с клиентским (SignArt, SignChip, SignGroup). Без контекста
// (тесты shared) знаков нет, чип и группа — простые запасные. Классы cg-* — concept-graph.css.
import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { PaperHue, SheetLook, SignKey } from '../../theme/entityLook';
import type { DigestKey } from './conceptDigestModel';

export type ConceptSignSize = 'nav' | 'row' | 'square';

export interface ConceptPaper {
  /** Рисунок знака по ключу (SignArt). */
  sign: (sign: SignKey, size: ConceptSignSize) => ReactNode;
  /** Чип-переключатель: выбранный — бумага с галочкой (SignChip). */
  Chip: ComponentType<{
    label: ReactNode;
    on: boolean;
    onToggle: () => void;
    sign?: SignKey;
    hue?: PaperHue;
  }>;
  /** Группа домена или группы режимов со знаком в шапке (SignGroup); `plain` — тихая, без листа бумаги. */
  Group: ComponentType<{
    look: SheetLook;
    title: ReactNode;
    rowsClassName?: string;
    plain?: boolean;
    children: ReactNode;
  }>;
  /** Сцена пустой схемы случая (SceneConceptStart). */
  emptyScene: ReactNode;
}

export const ConceptPaperContext = createContext<ConceptPaper | null>(null);

export const useConceptPaper = (): ConceptPaper | null =>
  useContext(ConceptPaperContext);

/** Знак строки сводки «Коротко» и блока «Главного» — знак сущности раздела. */
export const DIGEST_SIGN: Record<DigestKey, SignKey> = {
  schemas: 'layers',
  modes: 'cluster',
  cycle: 'ribbon',
  needs: 'strokes',
  goal: 'leaf',
};

/** Знак по ключу; без контекста или ключа — ничего (без выдуманной картинки). */
export function ConceptSign({
  sign,
  size = 'nav',
}: {
  sign: SignKey | undefined;
  size?: ConceptSignSize;
}) {
  const paper = useConceptPaper();
  if (!paper || !sign) return null;
  return (
    <span className={`cg-sign cg-sign--${size}`} aria-hidden="true">
      {paper.sign(sign, size)}
    </span>
  );
}

const MARK_PATH = {
  block: 'M4 4 L12 12 M12 4 L4 12',
  meet: 'M3 8.5 L6.5 12 L13 4.5',
  arrow: 'M2 8 H13 M9 4 L13 8 L9 12',
} as const;
export type ConceptMarkKind = keyof typeof MARK_PATH;

/** Тихий значок тоном подписи: ✗ блокирует, ✓ есть опора, → дальше. Путём, не глифом. */
export function ConceptMark({ kind }: { kind: ConceptMarkKind }) {
  return (
    <svg
      className="cg-mark"
      data-mark={kind}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        d={MARK_PATH[kind]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Чип «только показать»: белая поверхность, слева знак сущности — без радуги заливок. */
export function ConceptTag({
  sign,
  children,
}: {
  sign?: SignKey;
  children: ReactNode;
}) {
  return (
    <span className="cg-tag">
      <ConceptSign sign={sign} />
      {children}
    </span>
  );
}
