import { useCallback, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { SsSheet, SsHead } from './schemaSheets/SsSheet';
import { SignChip } from './paper/SignChip';
import { ShareIcon } from '../../../shared/src/share/ShareIcon';
import { domainLook, ENTITY_LOOK } from '../../../shared/src/theme/entityLook';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { MY_SCHEMA_IDS_KEY, cacheMySchemaIds } from '../utils/storageKeys';
import { api, reportClientError } from '../api';
import { useSaveFailure } from '../hooks/useSaveFailure';
import { SelectionSaveNote } from '../sections/schemas/SelectionSaveNote';
import { isUnwritableError } from '../../../shared/src/api/unwritableError';
import { BELIEFS } from './schemaSheets/schemaBeliefs';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { drawSchemaCard } from '../../../shared/src/share/cards/schemaCard';
import { schemaShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';

function readSchemaIds(): string[] {
  try { return JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '[]'); } catch { return []; }
}

interface Props {
  schemaId: string;
  onClose: () => void;
}

/** Карточка схемы (редизайн 2026-11, b16): герой — лист бумаги домена со знаком домена крупно (EntitySheet
 *  через SsHead look), домен — надписью, а не цветным чипом; убеждения — белый лист курсивом; действия —
 *  одна залитая «Познакомиться», «в мои схемы» — чип-переключатель бумаги домена, «Поделиться» — тихо. */
export function SchemaDetailSheet({ schemaId, onClose }: Props) {
  const navigate = useNavigate();
  const goBack = useHistorySheet(onClose); // явный onClose() у navigate() ниже убран — двойной вызов, see useHistorySheet.ts
  const domainEntry = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === schemaId));
  const schema = domainEntry?.schemas.find(s => s.id === schemaId);
  const [myIds, setMyIds] = useState<string[]>(readSchemaIds);
  const [showShare, setShowShare] = useState(false);
  // Отказ записи виден человеку, как на экране «Мои паттерны»: 409 «не читается» — свой текст.
  const save = useSaveFailure();
  const isAdded = myIds.includes(schemaId);

  const drawShareCard = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!schema || !domainEntry) return;
      drawSchemaCard(canvas, {
        domain: domainEntry.domain,
        domainColor: domainEntry.color,
        name: schema.name,
        desc: schema.libraryDesc ?? schema.desc,
        belief: BELIEFS[schemaId]?.[0],
      });
    },
    [schema, domainEntry, schemaId],
  );

  if (!schema || !domainEntry) return null;

  const beliefs = BELIEFS[schemaId] ?? [];

  function toggleSchema() {
    const next = isAdded
      ? myIds.filter(id => id !== schemaId)
      : [...myIds, schemaId];
    cacheMySchemaIds(next);
    setMyIds(next);
    save.track(api.updateSettings({ mySchemaIds: next }), () => reportClientError({ message: 'schema sheet save mySchemaIds failed', section: 'schemas' }));
  }

  const lede = schema.libraryDesc ?? schema.desc;
  const look = domainLook(domainEntry.id) ?? ENTITY_LOOK.schemas;

  return (
    <SsSheet onBack={goBack}>
      <SsHead look={look} eyebrow={domainEntry.domain} title={schema.name} lede={lede} />

      {beliefs.length > 0 && (
        <div className="ds-card ss-card-stack ss-beliefs" style={{ '--h': look.hue } as CSSProperties}>
          <div className="ds-label">Типичные убеждения</div>
          <div>
            {beliefs.map((b, i) => (
              <div key={i} className="ss-belief">
                <span className="ss-belief-dot" aria-hidden="true" />
                <span className="ss-belief-text">«{b}»</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ss-detail-actions">
        <button onClick={() => navigate('/exercises', { state: { openSchemaEx: schemaId } })} className="ds-btn ss-detail-go">
          Познакомиться →
        </button>
        <div className="ss-detail-row">
          <SignChip label={isAdded ? 'В моих схемах' : '+ В мои схемы'} on={isAdded} onToggle={toggleSchema} hue={look.hue} />
          <button type="button" onClick={() => setShowShare(true)} className="ds-link ss-share-link">
            <ShareIcon /> Поделиться
          </button>
        </div>
        <SelectionSaveNote failed={save.failed} blocked={save.failed && isUnwritableError(save.error)} />
      </div>

      {showShare && (
        <ShareCardSheet
          title="Карточка схемы"
          draw={drawShareCard}
          shareText={schemaShareText(schema.name, botShortUrl)}
          filename="schema.png"
          eventKind="schema"
          onClose={() => setShowShare(false)}
        />
      )}
    </SsSheet>
  );
}
