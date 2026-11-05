import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlyphCheck } from './exercises/ExScreen';
import { SsSheet } from './schemaSheets/SsSheet';
import { DOMAIN_HUE, hueStyle } from '../lib/tone';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { MY_SCHEMA_IDS_KEY } from '../utils/storageKeys';
import { api } from '../api';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { drawSchemaCard } from '../../../shared/src/share/cards/schemaCard';
import { schemaShareText } from '../../../shared/src/share/shareTexts';
import { botShortUrl } from '../utils/botConfig';

const BELIEFS: Record<string, string[]> = {
  emotional_deprivation:     ['Никто никогда по-настоящему не позаботится обо мне', 'Мне суждено остаться со своими переживаниями в одиночестве'],
  abandonment:               ['Все рано или поздно уходят', 'Я не могу рассчитывать на близких'],
  mistrust:                  ['Если открыться – обязательно предадут', 'Люди используют тех, кто им доверяет'],
  defectiveness:             ['Со мной что-то фундаментально не так', 'Если узнают правду – отвергнут'],
  social_isolation:          ['Я не как все', 'Я не вписываюсь ни в одну группу или сообщество'],
  dependence:                ['Мне не справиться в одиночку', 'Без поддержки я ничего не могу'],
  vulnerability:             ['Что-то плохое вот-вот случится', 'Мир опасен, и защиты у меня нет'],
  enmeshment:                ['Без этого человека я не знаю, кто я', 'Мы должны делить всё и всегда быть рядом'],
  failure:                   ['Я всегда проваливаюсь там, где другие успешны', 'Я глупее и некомпетентнее других'],
  entitlement:               ['Правила существуют для других, не для меня', 'Я заслуживаю особого отношения'],
  insufficient_self_control: ['Я не могу себя контролировать', 'Терпеть дискомфорт или откладывать удовольствие невыносимо'],
  subjugation:               ['Если скажу что думаю – будет только хуже', 'Мои желания и чувства неважны'],
  self_sacrifice:            ['Сначала все остальные, потом я', 'Думать о своём – это эгоизм'],
  approval_seeking:          ['Мне очень важно, что обо мне думают', 'Если не нравлюсь – значит, со мной что-то не так'],
  negativity:                ['Всё равно ничего хорошего не выйдет', 'Лучше не надеяться, чтобы не разочароваться'],
  emotion_inhibition_fear:   ['Если дам волю злости – потеряю контроль', 'Мои сильные эмоции опасны для других'],
  emotional_inhibition:      ['Показывать чувства – это слабость', 'Лучше держаться и не показывать вида'],
  unrelenting_standards:     ['От меня требуется безупречность', 'Ошибаться – недопустимо'],
  punitiveness_self:         ['Я заслуживаю наказания за ошибки', 'Прощать себя – значит оправдывать слабость'],
  punitiveness_others:       ['Людей нужно жёстко наказывать за ошибки', 'Прощать слабости – значит поощрять их'],
};

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
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(next));
    setMyIds(next);
    api.updateSettings({ mySchemaIds: next }).catch(() => {});
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
        <span className="ds-chip tone-tint" style={{ ...hueStyle(DOMAIN_HUE[domainEntry.id]), alignSelf: 'flex-start' }}>
          {domainEntry.domain}
        </span>
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
