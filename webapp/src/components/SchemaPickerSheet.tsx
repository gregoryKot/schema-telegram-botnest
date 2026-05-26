import { useState } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';

interface Props {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

const SCHEMA_DESC: Record<string, string> = {
  emotional_deprivation:    'Убеждение что эмоциональные потребности никогда не будут удовлетворены',
  abandonment:              'Страх что близкие бросят или станут недоступны',
  mistrust:                 'Ожидание что люди причинят боль, используют или обманут',
  defectiveness:            'Ощущение себя плохим, неполноценным или нелюбимым',
  social_isolation:         'Ощущение чужим — отличным от всех остальных людей',
  dependence:               'Ощущение неспособности справляться с жизнью самостоятельно',
  vulnerability:            'Преувеличенный страх катастрофы: болезни, краха, аварии',
  enmeshment:               'Чрезмерная вовлечённость с близкими за счёт своей идентичности',
  failure:                  'Убеждение что неизбежно потерпишь неудачу там где другие успешны',
  entitlement:              'Ощущение что правила для других, а ты особенный',
  insufficient_self_control:'Сложно терпеть дискомфорт, откладывать удовольствия или рутину',
  subjugation:              'Подавление своих желаний чтобы избежать гнева или отвержения',
  self_sacrifice:           'Чрезмерный фокус на нуждах других в ущерб собственным',
  approval_seeking:         'Сильная потребность в одобрении в ущерб подлинному себе',
  negativity:               'Фокус на негативе: потере, разочаровании, худшем сценарии',
  emotion_inhibition_fear:  'Страх потерять контроль над эмоциями или импульсами',
  emotional_inhibition:     'Сдерживание эмоций, спонтанности и естественного общения',
  unrelenting_standards:    'Жёсткие внутренние требования чтобы избежать критики',
  punitiveness_self:        'Жёсткое наказание себя за ошибки',
  punitiveness_others:      'Жёсткое суждение и наказание других за ошибки',
};

export function SchemaPickerSheet({ selected, onSave, onClose }: Props) {
  const [ids, setIds] = useState<string[]>(selected);

  const toggle = (id: string) =>
    setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="ex-btn ex-btn-ghost" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
        <button
          className="ex-btn ex-btn-primary"
          onClick={() => { onSave(ids); onClose(); }}
          style={{ padding: '6px 18px', fontSize: 14 }}
        >
          Сохранить{ids.length > 0 ? ` (${ids.length})` : ''}
        </button>
      </div>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', lineHeight: 1.15, marginBottom: 10 }}>
          Мои схемы
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 28, lineHeight: 1.6 }}>
          Выбери схемы, которые тебе близки. Можно без теста — если ты уже знаешь свои.
        </p>

        {SCHEMA_DOMAINS.map(domain => (
          <div key={domain.id} style={{ marginBottom: 24 }}>
            <div className="eyebrow" style={{ color: domain.color, marginBottom: 10, opacity: 0.8 }}>
              {domain.domain}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {domain.schemas.map(s => {
                const active = ids.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
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
      </div>
    </div>
  );
}
