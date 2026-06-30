import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';

interface Props {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

const SCHEMA_DESC: Record<string, string> = {
  emotional_deprivation:   'Убеждение что эмоциональные потребности никогда не будут удовлетворены',
  abandonment:             'Страх что близкие бросят или станут недоступны',
  mistrust:                'Ожидание что люди причинят боль, используют или обманут',
  defectiveness:           'Ощущение себя плохим, неполноценным или нелюбимым',
  social_isolation:        'Ощущение чужим — отличным от всех остальных людей',
  dependence:              'Ощущение неспособности справляться с жизнью самостоятельно',
  vulnerability:           'Преувеличенный страх катастрофы: болезни, краха, аварии',
  enmeshment:              'Чрезмерная вовлечённость с близкими за счёт своей идентичности',
  failure:                 'Убеждение что неизбежно потерпишь неудачу там где другие успешны',
  entitlement:             'Ощущение что правила для других, а ты особенный',
  insufficient_self_control:'Сложно терпеть дискомфорт, откладывать удовольствия или рутину',
  subjugation:             'Подавление своих желаний чтобы избежать гнева или отвержения',
  self_sacrifice:          'Чрезмерный фокус на нуждах других в ущерб собственным',
  approval_seeking:        'Сильная потребность в одобрении в ущерб подлинному себе',
  negativity:              'Фокус на негативе: потере, разочаровании, худшем сценарии',
  emotion_inhibition_fear: 'Страх потерять контроль над эмоциями или импульсами',
  emotional_inhibition:    'Сдерживание эмоций, спонтанности и естественного общения',
  unrelenting_standards:   'Жёсткие внутренние требования чтобы избежать критики',
  punitiveness_self:       'Жёсткое наказание себя за ошибки',
  punitiveness_others:     'Жёсткое суждение и наказание других за ошибки',
};

export function SchemaPickerSheet({ selected, onSave, onClose }: Props) {
  const [ids, setIds] = useState<string[]>(selected);

  const toggle = (id: string) =>
    setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Мои схемы</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.5 }}>
          Выбери схемы, которые тебе близки. Можно без теста — если ты уже знаешь свои.
        </div>

        {SCHEMA_DOMAINS.map(domain => (
          <div key={domain.id} style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: domain.color, marginBottom: 8, opacity: 0.8,
            }}>
              {domain.domain}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {domain.schemas.map(s => {
                const active = ids.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                      background: active ? `${domain.color}12` : 'rgba(var(--fg-rgb),0.03)',
                      border: `1px solid ${active ? `${domain.color}30` : 'rgba(var(--fg-rgb),0.06)'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? domain.color : 'rgba(var(--fg-rgb),0.2)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: active ? 'var(--text)' : 'rgba(var(--fg-rgb),0.6)', fontWeight: active ? 600 : 400 }}>{s.name}</div>
                      {SCHEMA_DESC[s.id] && (
                        <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.4 }}>{SCHEMA_DESC[s.id]}</div>
                      )}
                    </div>
                    {active && <span style={{ color: domain.color, fontSize: 14, flexShrink: 0 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button
          onClick={() => { onSave(ids); onClose(); }}
          style={{
            marginTop: 8, width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
            color: 'var(--text)', fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Сохранить{ids.length > 0 ? ` (${ids.length})` : ''}
        </button>
      </div>
    </BottomSheet>
  );
}
