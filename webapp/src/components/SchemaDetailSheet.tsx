import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { MY_SCHEMA_IDS_KEY } from '../utils/storageKeys';
import { api } from '../api';

const BELIEFS: Record<string, string[]> = {
  emotional_deprivation:     ['Никто никогда по-настоящему не позаботится обо мне', 'Я обречён(а) быть один(а) в своих переживаниях'],
  abandonment:               ['Все рано или поздно уходят', 'Я не могу рассчитывать на близких'],
  mistrust:                  ['Если открыться — обязательно предадут', 'Люди используют тех, кто им доверяет'],
  defectiveness:             ['Со мной что-то фундаментально не так', 'Если узнают правду — отвергнут'],
  social_isolation:          ['Я не такой(ая) как все', 'Я не вписываюсь ни в одну группу или сообщество'],
  dependence:                ['Я не справлюсь сам(а)', 'Без поддержки я беспомощен(на)'],
  vulnerability:             ['Что-то плохое вот-вот случится', 'Мир опасен, и я не защищён(а)'],
  enmeshment:                ['Без этого человека я не знаю, кто я', 'Мы должны делить всё и всегда быть рядом'],
  failure:                   ['Я всегда проваливаюсь там, где другие успешны', 'Я глупее и некомпетентнее других'],
  entitlement:               ['Правила существуют для других, не для меня', 'Я заслуживаю особого отношения'],
  insufficient_self_control: ['Я не могу себя контролировать', 'Терпеть дискомфорт или откладывать удовольствие невыносимо'],
  subjugation:               ['Если скажу что думаю — будет только хуже', 'Мои желания и чувства неважны'],
  self_sacrifice:            ['Сначала все остальные, потом я', 'Думать о своём — это эгоизм'],
  approval_seeking:          ['Мне очень важно, что обо мне думают', 'Если не нравлюсь — значит, со мной что-то не так'],
  negativity:                ['Всё равно ничего хорошего не выйдет', 'Лучше не надеяться — не разочаруешься'],
  emotion_inhibition_fear:   ['Если дам волю злости — потеряю контроль', 'Мои сильные эмоции опасны для других'],
  emotional_inhibition:      ['Показывать чувства — это слабость', 'Лучше держаться и не показывать вида'],
  unrelenting_standards:     ['Я должен(на) быть идеальным(ой)', 'Ошибаться — недопустимо'],
  punitiveness_self:         ['Я заслуживаю наказания за ошибки', 'Прощать себя — значит оправдывать слабость'],
  punitiveness_others:       ['Людей нужно жёстко наказывать за ошибки', 'Прощать слабости — значит поощрять их'],
};

function readSchemaIds(): string[] {
  try { return JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '[]'); } catch { return []; }
}

const GlyphBack = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3L5 8l5 5" />
  </svg>
);

interface Props {
  schemaId: string;
  onClose: () => void;
}

export function SchemaDetailSheet({ schemaId, onClose }: Props) {
  const navigate = useNavigate();
  const domainEntry = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === schemaId));
  const schema = domainEntry?.schemas.find(s => s.id === schemaId);
  const [myIds, setMyIds] = useState<string[]>(readSchemaIds);
  const isAdded = myIds.includes(schemaId);

  if (!schema || !domainEntry) return null;

  const beliefs = BELIEFS[schemaId] ?? [];
  const domainColor = domainEntry.color;

  function toggleSchema() {
    const next = isAdded
      ? myIds.filter(id => id !== schemaId)
      : [...myIds, schemaId];
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(next));
    setMyIds(next);
    api.updateSettings({ mySchemaIds: next }).catch(() => {});
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: '4px 0' }}>
          <GlyphBack /> Назад
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 32px 80px' }}>
        {/* Eyebrow */}
        <div className="eyebrow" style={{ color: domainColor, marginBottom: 12 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: domainColor, marginRight: 8, verticalAlign: 'middle' }} />
          {domainEntry.domain}
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 24 }}>
          {schema.name}
        </h1>

        {/* Description */}
        <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text-sub)', marginBottom: 40, maxWidth: 600 }}>
          {schema.libraryDesc ?? schema.desc}
        </p>

        {/* Beliefs */}
        {beliefs.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Типичные убеждения</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {beliefs.map((b, i) => (
                <div key={i} style={{ padding: '16px 0', borderTop: '1px solid var(--line)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <span style={{ color: domainColor, fontFamily: 'var(--serif)', fontSize: 24, lineHeight: 1, flexShrink: 0, marginTop: -2 }}>·</span>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 19, fontStyle: 'italic', lineHeight: 1.5, color: 'var(--text)' }}>«{b}»</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--line)' }} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={toggleSchema}
            className={'ex-btn ' + (isAdded ? 'ex-btn-outline' : 'ex-btn-ghost')}
            style={{ minWidth: 180 }}
          >
            {isAdded ? '✓ В моих схемах' : '+ В мои схемы'}
          </button>
          <button
            onClick={() => { onClose(); navigate('/exercises', { state: { openSchemaEx: schemaId } }); }}
            className="ex-btn ex-btn-primary"
          >
            Познакомиться →
          </button>
        </div>
      </div>
    </div>
  );
}
