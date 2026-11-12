// Реестр знаков: ключ (SIGN_KEYS, shared/src/theme/entityLook.ts) → рисунок. Один компонент
// <SignArt sign="…" size="…" /> на кабинет клиента и терапевта, подсказки и сцены: строки
// списков, герои потоков, листы «готово» и пункты меню берут ключ из ENTITY_LOOK, а не
// импортируют мотив на месте (docs/design/PAPER_2026-11.md, «Мотив → смысл»). Знак не
// перерисовывается: каждый ключ ведёт в тот же мотив, что виден в кабинете. Знаки листов
// подсказок — таблица guideSignDrawings.ts (её же берёт GuideSignArt), здесь — остальные.
// Внутри сцены (ArtFrameContext) знак ложится вложенным svg своей рамки — см. PaperSvg.tsx.
// plate="surface" — знак крупно на своей бумаге (SignHero, SignInScene): плашку Check рисует
// бумагой --surface (вариант мотива); знаки без плашки проп не читают.
import type { ReactElement } from 'react';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import type { ArtProps } from './paper';
import { Cup, Strokes } from './PaperArt';
import { Check, Leaf, Wheel, type CheckPlate } from './PaperArtSigns';
import { Limits, NeedArt } from './NeedArt';
import { DomainArt } from './DomainArt';
import { Grounded, Haven, Join, Pause } from './AppSigns';
import { GUIDE_SIGN_ART } from './guideSignDrawings';
import { CountedSign } from './CountedSign';
import { countedDrawing } from '../../../../shared/src/share/kit/countedSigns';

type Art = (p: ArtProps & { plate?: CheckPlate }) => ReactElement | null;

const need = (id: string): Art => function NeedSign({ size }) { return <NeedArt id={id} size={size} />; };
const domain = (n: number): Art => function DomainSign({ size }) { return <DomainArt domain={n} size={size} />; };

const BY_KEY: Record<SignKey, Art> = {
  ...GUIDE_SIGN_ART,
  check: Check,
  strokes: Strokes, cup: Cup, leaf: Leaf, wheel: Wheel,
  need_attachment: need('attachment'), need_autonomy: need('autonomy'), need_expression: need('expression'),
  need_play: need('play'), need_limits: Limits,
  // порядок DomainArt — порядок SCHEMA_DOMAINS (D1…D5), ключи — id из DOMAIN_HUE
  domain_rejection: domain(1), domain_autonomy: domain(2), domain_limits: domain(3),
  domain_other_directed: domain(4), domain_vigilance: domain(5),
  grounded: Grounded, pause: Pause, haven: Haven, join: Join,
};

/** Знак по ключу; ключа нет в реестре (данные с сервера, старая запись) — ничего, без выдуманной картинки.
 *  `count` — вариант мотива по счёту (значки достижений, countedSigns.ts); у знака без варианта не читается. */
export function SignArt({ sign, size, plate, count }: ArtProps & { sign: SignKey; plate?: CheckPlate; count?: number }) {
  const counted = countedDrawing(sign, count);
  if (counted) return <CountedSign drawing={counted} size={size} />;
  const Art = Object.hasOwn(BY_KEY, sign) ? BY_KEY[sign] : null;
  return Art ? <Art size={size} plate={plate} /> : null;
}
