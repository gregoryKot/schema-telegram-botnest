import { useState } from 'react';
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

interface Props {
  schemaId: string;
  onClose: () => void;
  onOpenDiary: () => void;
}

export function SchemaDetailSheet({ schemaId, onClose, onOpenDiary }: Props) {
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--sheet-bg)',
          borderRadius: '24px 24px 0 0',
          padding: '8px 20px 40px',
          maxHeight: '80%',
          overflowY: 'auto',
          animation: 'sheet-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-color)', margin: '8px auto 20px' }} />

        {/* Domain + Schema name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: domainColor, flexShrink: 0, marginTop: 7 }} />
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
              color: domainColor, marginBottom: 5,
            }}>
              {domainEntry.domain}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {schema.name}
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border-color)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.65 }}>
            {schema.libraryDesc ?? schema.desc}
          </div>
        </div>

        {/* Beliefs */}
        {beliefs.length > 0 && (
          <>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-faint)', marginBottom: 8,
            }}>
              Типичные убеждения
            </div>
            <div style={{
              background: 'var(--surface-2)', border: '1px solid var(--border-color)',
              borderRadius: 16, padding: '4px 16px', marginBottom: 16,
            }}>
              {beliefs.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '10px 0',
                  borderTop: i > 0 ? '1px solid var(--border-color)' : undefined,
                }}>
                  <span style={{ color: domainColor, flexShrink: 0, fontSize: 18, lineHeight: 1 }}>·</span>
                  <span style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, fontStyle: 'italic' }}>
                    «{b}»
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={toggleSchema}
            style={{
              flex: 1, padding: '13px', borderRadius: 14, border: 'none',
              fontFamily: 'inherit',
              background: isAdded ? 'var(--surface-2)' : 'color-mix(in srgb, var(--accent) 12%, transparent)',
              outline: `1px solid ${isAdded ? 'var(--border-color)' : 'color-mix(in srgb, var(--accent) 30%, transparent)'}`,
              color: isAdded ? 'var(--text-faint)' : 'var(--accent)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {isAdded ? '✓ В моих схемах' : '+ В мои схемы'}
          </button>
          <button
            onClick={() => { onClose(); onOpenDiary(); }}
            style={{
              flex: 1, padding: '13px', borderRadius: 14, border: 'none',
              fontFamily: 'inherit',
              background: 'linear-gradient(135deg, var(--accent), #60a5fa)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Познакомиться →
          </button>
        </div>
      </div>
    </div>
  );
}
