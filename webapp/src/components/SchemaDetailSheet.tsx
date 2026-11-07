import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlyphCheck } from './exercises/ExScreen';
import { DomainMark } from './DomainMark';
import { SsSheet } from './schemaSheets/SsSheet';
import { DOMAIN_HUE, hueStyle } from '../lib/tone';
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
  const actions = (
    <>
      <button onClick={toggleSchema} className={'ds-btn ds-btn--secondary'}>
        {isAdded ? <><GlyphCheck /> В моих схемах</> : '+ В мои схемы'}
      </button>
      <button onClick={() => navigate('/exercises', { state: { openSchemaEx: schemaId } })} className="ds-btn">
        Познакомиться →
      </button>
      <button onClick={() => setShowShare(true)} className="ds-btn ds-btn--secondary">
        Поделиться
      </button>
    </>
  );

  return (
    <SsSheet onBack={goBack}>
      <div className="ss-head">
        <div className="ss-domain-line">
          <DomainMark domainId={domainEntry.id} size="square" />
          <span className="ds-chip tone-tint" style={hueStyle(DOMAIN_HUE[domainEntry.id])}>{domainEntry.domain}</span>
        </div>
        <h1 className="ss-title">{schema.name}</h1>
        <p className="ss-lede">{lede}</p>
      </div>

      {beliefs.length > 0 && (
        <div className="ds-card ss-card-stack">
          <div className="ds-label">Типичные убеждения</div>
          <div style={hueStyle(DOMAIN_HUE[domainEntry.id])}>
            {beliefs.map((b, i) => (
              <div key={i} className="ss-belief">
                <span className="ss-belief-dot tone-text">·</span>
                <span className="ss-belief-text">«{b}»</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ss-actions ss-actions--row">{actions}</div>
      <SelectionSaveNote failed={save.failed} blocked={save.failed && isUnwritableError(save.error)} />

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
