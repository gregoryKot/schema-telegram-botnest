import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { MY_SCHEMA_IDS_KEY } from '../utils/storageKeys';
import { api } from '../api';

const BELIEFS: Record<string, string[]> = {
  emotional_deprivation:     ['Никто никогда по-настоящему не позаботится обо мне', 'Я обречён(а) быть один(а) в своих переживаниях'],
  abandonment:               ['Все рано или поздно уходят', 'Я не могу рассчитывать на близких'],
  mistrust:                  ['Если открыться – обязательно предадут', 'Люди используют тех, кто им доверяет'],
  defectiveness:             ['Со мной что-то фундаментально не так', 'Если узнают правду – отвергнут'],
  social_isolation:          ['Я не такой(ая) как все', 'Я не вписываюсь ни в одну группу или сообщество'],
  dependence:                ['Я не справлюсь сам(а)', 'Без поддержки я беспомощен(на)'],
  vulnerability:             ['Что-то плохое вот-вот случится', 'Мир опасен, и я не защищён(а)'],
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
  unrelenting_standards:     ['Я должен(на) быть идеальным(ой)', 'Ошибаться – недопустимо'],
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
  const goBack = useHistorySheet(onClose);
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
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow={domainEntry.domain}
      eyebrowColor={domainColor}
      title={<>{schema.name}</>}
      lede={schema.libraryDesc ?? schema.desc}
      aside={
        <div className="aside-card" style={{ borderColor: domainColor + '40', background: domainColor + '08', position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color: domainColor }}>Домен</div>
          <h3 style={{ fontSize: 18 }}>{domainEntry.domain}</h3>
          <p className="body">{'Группа схем, связанных общей темой.'}</p>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={toggleSchema}
              className={'ex-btn ' + (isAdded ? 'ex-btn-outline' : 'ex-btn-ghost')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {isAdded ? <><GlyphCheck /> В моих схемах</> : '+ В мои схемы'}
            </button>
            <button
              onClick={() => { onClose(); navigate('/exercises', { state: { openSchemaEx: schemaId } }); }}
              className="ex-btn ex-btn-primary"
              style={{ width: '100%' }}
            >
              Познакомиться →
            </button>
          </div>
        </div>
      }
    >
      {beliefs.length > 0 && (
        <div className="prompt">
          <div className="prompt-num">·</div>
          <div style={{ width: '100%' }}>
            <div className="prompt-label">Типичные убеждения</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {beliefs.map((b, i) => (
                <div key={i} style={{ padding: '16px 0', borderTop: '1px solid var(--line)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <span style={{ color: domainColor, fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>·</span>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', lineHeight: 1.55, color: 'var(--text)' }}>«{b}»</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--line)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile action buttons (aside hidden on small screens) */}
      <div className="ex-foot">
        <button
          onClick={toggleSchema}
          className={'ex-btn ' + (isAdded ? 'ex-btn-outline' : 'ex-btn-ghost')}
        >
          {isAdded ? <><GlyphCheck /> В моих схемах</> : '+ В мои схемы'}
        </button>
        <button
          onClick={() => { onClose(); navigate('/exercises', { state: { openSchemaEx: schemaId } }); }}
          className="ex-btn ex-btn-primary"
        >
          Познакомиться →
        </button>
      </div>
    </ExScreen>
  );
}
