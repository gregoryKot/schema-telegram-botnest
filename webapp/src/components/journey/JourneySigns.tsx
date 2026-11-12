// Знаки «Моего пути» сайта (b22-journey) — то, что общие компоненты ленты получают инъекцией (shared
// не импортирует webapp): знак строки 44×24 на бумаге своей сущности, плитка счётчика (знак + число +
// подпись на бумаге занятия), шапка детали — лист EntitySheet сущности шага, голос Здорового Взрослого —
// вставка мха HealthyVoice. Вид — один источник journeyLook.ts (ENTITY_LOOK); режим — знак группы.
// Здесь только компоненты (fast refresh); связка в пропсы kit/art — webJourneyKit.ts.
import type { JourneyItem } from '../../../../shared/src/journey/journeyMeta';
import type { JourneyStatRow } from '../../../../shared/src/journey/journeyStats';
import { journeyItemLook, journeyStatLook } from '../../../../shared/src/journey/journeyLook';
import type { Look } from '../../../../shared/src/theme/entityLook';
import { glueSpaces } from '../../../../shared/src/utils/typo';
import { hueStyle } from '../../lib/tone';
import { SignArt } from '../art/SignArt';
import { EntitySheet } from '../paper/EntitySheet';
import { HealthyVoice } from '../paper/HealthyVoice';
import { modeLookById } from '../diary/modeLookById';

const modeSign = (modeId: string) => modeLookById(modeId).sign;
const itemLook = (item: JourneyItem): Look | null => journeyItemLook(item, modeSign);

/** Знак строки ленты; незнакомый тип — пустая бумажка (строки стоят ровно), без выдуманного знака. */
export function JourneySign({ look }: { look: Look | null }) {
  return (
    <span className="pp-row-art jr-sign" style={look ? hueStyle(look.hue) : undefined} data-sign={look?.sign} aria-hidden="true">
      {look && <SignArt sign={look.sign} size="row" />}
    </span>
  );
}

export function JourneyRowSign({ item }: { item: JourneyItem }) {
  return <JourneySign look={itemLook(item)} />;
}

/** Плитка счётчика: бумага занятия, знак, число Literata и подпись. */
export function JourneyStat({ row }: { row: JourneyStatRow }) {
  const look = journeyStatLook(row.type);
  return (
    <div className="pp-paper jr-stat" style={look ? hueStyle(look.hue) : undefined}>
      <span className="jr-stat-sign" aria-hidden="true">{look && <SignArt sign={look.sign} size="row" />}</span>
      <span className="jr-stat-num">{row.count}</span>
      <span className="jr-stat-label">{row.label}</span>
    </div>
  );
}

/** Шапка детали — лист сущности шага со знаком (без знака — небо «Моего пути»). */
export function JourneyDetailHead({ item, label, line }: { item: JourneyItem; label: string; line: string }) {
  return <EntitySheet look={itemLook(item) ?? { hue: 240 }} title={label} sub={line} titleAs="h1" compact className="jr-detail-sheet" />;
}

/** Голос Здорового Взрослого в детали — вставка мха. */
export function JourneyVoice({ title, text }: { title: string; text: string }) {
  return <HealthyVoice label={title} text={glueSpaces(text)} className="jr-voice" />;
}
