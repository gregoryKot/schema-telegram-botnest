import { useState } from 'react';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
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
  social_isolation:         'Ощущение чужим – отличным от всех остальных людей',
  dependence:               'Ощущение неспособности справляться с жизнью самостоятельно',
  vulnerability:            'Преувеличенный страх катастрофы: болезни, краха, аварии',
  enmeshment:               'Чрезмерная вовлечённость с близкими за счёт своей идентичности',
  failure:                  'Убеждение в неизбежном провале там где другие успешны',
  entitlement:              'Ощущение собственной исключительности: правила будто для других',
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
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [ids, setIds] = useState<string[]>(selected);

  const toggle = (id: string) =>
    setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow="Схемы"
      eyebrowColor="var(--accent)"
      title={<>Мои<br /><span className="it">схемы</span></>}
      lede={tr('Выбери схемы, которые тебе близки. Можно без теста – если ты уже знаешь свои.', 'Выберите схемы, которые вам близки. Можно без теста – если вы уже знаете свои.')}
    >
      {SCHEMA_DOMAINS.map(domain => (
        <div key={domain.id} style={{ marginBottom: 28 }}>
          <div className="chip-section-eyebrow" style={{ color: domain.color }}>
            <span className="dot" style={{ background: domain.color }} />
            {domain.domain}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {domain.schemas.map(s => {
              const active = ids.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={'mode-card ' + (active ? 'is-selected' : '')}
                  style={{ '--mode-color': domain.color } as React.CSSProperties}
                >
                  <span className="mode-card-stripe" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mode-card-name">{s.name}</div>
                    {SCHEMA_DESC[s.id] && (
                      <div className="mode-card-short">{SCHEMA_DESC[s.id]}</div>
                    )}
                  </div>
                  {active && <span className="mode-check"><GlyphCheck /></span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="ex-foot">
        <span className="spacer" />
        <button
          className="ex-btn ex-btn-primary"
          onClick={() => { onSave(ids); goBack(); }}
        >
          {ids.length > 0 ? `Сохранить (${ids.length})` : 'Сохранить'}
        </button>
      </div>
    </ExScreen>
  );
}
