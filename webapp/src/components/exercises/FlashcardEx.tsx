import { useState } from 'react';
import { api } from '../../api';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { ExScreen, GlyphArrowLeft, GlyphArrowRight, GlyphCheck } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';

const SCHEMA_QUESTIONS = [
  { key: 'triggers',    label: 'Что запускает эту схему?',        hint: 'Ситуации, слова, интонации – типичные триггеры', placeholder: 'Когда не отвечают на сообщения; когда критикуют при других…' },
  { key: 'feelings',    label: 'Как проявляется в теле и чувствах?', hint: 'Эмоции и ощущения когда схема активна', placeholder: 'Тревога и ком в горле; злость и напряжение в груди…' },
  { key: 'thoughts',    label: 'Что говорит голос схемы?',         hint: 'Устойчивые убеждения – про себя, про других, про будущее', placeholder: '«Меня никто не ценит», «Я всегда облажаюсь»…' },
  { key: 'origins',     label: 'Откуда эта схема пришла?',         hint: 'Опыт из детства или юности', placeholder: 'Папа говорил что я недостаточно стараюсь; в школе чувствовал себя чужим…', optional: true },
  { key: 'reality',     label: 'Что реально, а что говорит схема?', hint: 'Факты, которые противоречат голосу схемы', placeholder: 'Есть люди которые ценят меня; большинство прогнозов схемы не сбылись…' },
  { key: 'healthyView', label: 'Слова Здорового Взрослого',        hint: 'Что зрелая, сострадательная часть тебя говорит', placeholder: '«Эта боль из прошлого, сейчас я в безопасности»…' },
  { key: 'behavior',    label: 'Что помогает когда схема активна?', hint: 'Действия и практики вместо привычных реакций', placeholder: 'Написать что чувствую; позвонить другу; короткая медитация…' },
];

const MODE_QUESTIONS = [
  { key: 'triggers',  label: 'Когда этот режим активируется?', hint: 'Ситуации, люди, слова – что его запускает', placeholder: 'Когда меня критикуют, когда нужно выступить…' },
  { key: 'feelings',  label: 'Что чувствуешь в этом режиме?',  hint: 'Эмоции и ощущения в теле', placeholder: 'Тревога, комок в горле, напряжение в плечах…' },
  { key: 'thoughts',  label: 'Что говорит этот режим внутри?', hint: 'Убеждения, монолог, голос', placeholder: '«Я недостаточно хорош», «Лучше не рисковать»…' },
  { key: 'needs',     label: 'Чего он на самом деле хочет?',   hint: 'Глубинная потребность за этим режимом', placeholder: 'Безопасности, признания, контакта…' },
  { key: 'behavior',  label: 'Как проявляется в поведении?',   hint: 'Что делаешь (или перестаёшь делать) в этом режиме', placeholder: 'Замолкаю, избегаю, злюсь, переусердствую…' },
];

type Q = { key: string; label: string; hint: string; placeholder: string; optional?: boolean };

function FlashcardFlow({ questions, accentColor, onSave }: { questions: Q[]; accentColor: string; onSave: (data: Record<string,string>) => Promise<void> }) {
  const [data, setData] = useState<Record<string,string>>(() => Object.fromEntries(questions.map(q => [q.key, ''])));
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const filled = questions.map(q => !!data[q.key].trim());
  const q = questions[step];
  const isLast = step === questions.length - 1;

  async function handleSave() { await onSave(data); setDone(true); }

  if (done) {
    return (
      <div className="done-card animate-slide">
        <div className="stamp"><GlyphCheck /> Карточка сохранена · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
        {questions.map((qq, i) => data[qq.key].trim() && (
          <div key={qq.key}>
            <div className="dlabel" style={{ color: i % 2 === 0 ? accentColor : 'var(--text-faint)' }}>{String(i + 1).padStart(2, '0')} · {qq.label}</div>
            <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.65, marginBottom: 18 }}>{data[qq.key]}</div>
          </div>
        ))}
        <button className="ex-btn ex-btn-outline" onClick={() => { setDone(false); setStep(0); }} style={{ marginTop: 12 }}>Изменить карточку</button>
      </div>
    );
  }

  return (<>
    <div className="tick-strip">
      {questions.map((_, i) => <div key={i} className={'tick ' + (filled[i] ? 'is-filled ' : '') + (i === step ? 'is-active' : '')} style={{ '--accent': accentColor } as React.CSSProperties} onClick={() => setStep(i)} />)}
    </div>
    <div className="flash" style={{ borderColor: data[q.key].trim() ? accentColor + '55' : 'var(--line)' }}>
      <div className="flash-eyebrow" style={{ color: accentColor }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />
        Вопрос {step + 1} из {questions.length}
        {q.optional && <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-faint)' }}>· можно пропустить</span>}
        <span className="flash-counter">{filled.filter(x => x).length} / {questions.length} заполнено</span>
      </div>
      <div className="flash-q">{q.label}</div>
      <div className="flash-hint">{q.hint}</div>
      <textarea className="paper-area" rows={5} value={data[q.key]} onChange={e => setData(d => ({ ...d, [q.key]: e.target.value }))} placeholder={q.placeholder} autoFocus />
    </div>
    <div className="ex-foot">
      <button className="ex-btn ex-btn-ghost" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}><GlyphArrowLeft /> Назад</button>
      <span className="spacer" />
      {!isLast
        ? <button className="ex-btn ex-btn-primary" onClick={() => setStep(s => s + 1)}>{data[q.key].trim() ? 'Дальше' : 'Пропустить'} <GlyphArrowRight /></button>
        : <button className="ex-btn ex-btn-primary" disabled={!filled.some(x => x)} onClick={handleSave}>Сохранить карточку <GlyphCheck /></button>
      }
    </div>
  </>);
}

export function SchemaEx({ onBack, initialSchemaId, onComplete }: { onBack: () => void; initialSchemaId?: string; onComplete?: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [picked, setPicked] = useState<{ id: string; name: string; desc: string; color: string; domain: string } | null>(() => {
    if (!initialSchemaId) return null;
    for (const d of SCHEMA_DOMAINS) {
      const s = d.schemas.find(s => s.id === initialSchemaId);
      if (s) return { id: s.id, name: s.name, desc: s.libraryDesc, color: d.color, domain: d.domain };
    }
    return null;
  });

  if (!picked) {
    return (
      <ExScreen onBack={goBack} eyebrow="№ 02 · Знакомство" eyebrowColor="var(--c-plum)"
        title={<>Карточка<br/><span className="it">схемы</span></>}
        lede={tr('Выбери одну из схем. Семь вопросов, чтобы увидеть её во весь рост: триггеры, голос, истоки, реальность, поддержка.', 'Выберите одну из схем. Семь вопросов, чтобы увидеть её во весь рост: триггеры, голос, истоки, реальность, поддержка.')}
        aside={<div className="aside-card"><div className="aside-card-eyebrow">Зачем это</div><h3>Назвать – значит вернуть себе власть</h3><p className="body">{tr('Схема работает в тени. Когда мы её называем – она становится паттерном, а не «правдой о тебе».', 'Схема работает в тени. Когда мы её называем – она становится паттерном, а не «правдой о вас».')}</p></div>}
      >
        {SCHEMA_DOMAINS.map(d => (
          <div key={d.id}>
            <div className="eyebrow" style={{ color: d.color, marginBottom: 10, marginTop: 24 }}>{d.domain}</div>
            {d.schemas.map(s => (
              <div key={s.id} onClick={() => setPicked({ id: s.id, name: s.name, desc: s.libraryDesc, color: d.color, domain: d.domain })}
                style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: 18, alignItems: 'start', padding: '16px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, marginTop: 10 }} />
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1.1, color: 'var(--text)', marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>{s.libraryDesc}</div>
                </div>
                <span style={{ color: 'var(--text-ghost)', fontSize: 22, marginTop: 8 }}>›</span>
              </div>
            ))}
          </div>
        ))}
      </ExScreen>
    );
  }

  return (
    <ExScreen onBack={goBack} eyebrow={picked.domain} eyebrowColor={picked.color} title={picked.name} lede={picked.desc}
      aside={<>
        <div className="aside-card" style={{ borderColor: picked.color + '40', background: picked.color + '08' }}>
          <div className="aside-card-eyebrow" style={{ color: picked.color }}>Совет</div>
          <h3>Без правильных ответов</h3>
          <p className="body">Пиши коротко, своими словами – даже одно предложение полезнее, чем идеальный абзац.</p>
        </div>
        <button className="ex-btn ex-btn-ghost" onClick={() => setPicked(null)} style={{ padding: '8px 12px' }}><GlyphArrowLeft /> Сменить схему</button>
      </>}
    >
      <FlashcardFlow questions={SCHEMA_QUESTIONS} accentColor={picked.color} onSave={async data => { await api.saveSchemaNote({ schemaId: picked.id, ...data }); onComplete?.(); }} />
    </ExScreen>
  );
}

export function ModeEx({ onBack, initialModeId, onComplete }: { onBack: () => void; initialModeId?: string; onComplete?: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [picked, setPicked] = useState<{ id: string; name: string; short: string; color: string; group: string } | null>(() => {
    if (!initialModeId) return null;
    for (const g of MODE_GROUPS) {
      const m = g.items.find(m => m.id === initialModeId);
      if (m) return { id: m.id, name: m.name, short: m.short, color: g.color, group: g.group };
    }
    return null;
  });

  if (!picked) {
    return (
      <ExScreen onBack={goBack} eyebrow="№ 03 · Знакомство" eyebrowColor="var(--c-clay)"
        title={<>Карточка<br/><span className="it">режима</span></>}
        lede="Режим – это эмоциональное состояние, которое включается целиком. Описать его – значит научиться его узнавать в моменте."
        aside={<div className="aside-card"><div className="aside-card-eyebrow">Совет</div><h3>{tr('Начни с того, что чаще включается', 'Начните с того, что чаще включается')}</h3><p className="body">Не обязательно работать с трудным режимом. Иногда полезнее описать Здорового Взрослого – чтобы было что искать в себе в трудный момент.</p></div>}
      >
        {MODE_GROUPS.map(g => (
          <div key={g.id}>
            <div className="eyebrow" style={{ color: g.color, marginBottom: 10, marginTop: 24 }}>{g.group}</div>
            {g.items.map(m => (
              <div key={m.id} onClick={() => setPicked({ id: m.id, name: m.name, short: m.short, color: g.color, group: g.group })}
                style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: 18, alignItems: 'start', padding: '14px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: g.color, marginTop: 8 }} />
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1.15, color: 'var(--text)', marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>{m.short}</div>
                </div>
                <span style={{ color: 'var(--text-ghost)', fontSize: 22, marginTop: 6 }}>›</span>
              </div>
            ))}
          </div>
        ))}
      </ExScreen>
    );
  }

  return (
    <ExScreen onBack={goBack} eyebrow={picked.group} eyebrowColor={picked.color} title={picked.name} lede={picked.short}
      aside={<>
        <div className="aside-card" style={{ borderColor: picked.color + '40', background: picked.color + '08' }}>
          <div className="aside-card-eyebrow" style={{ color: picked.color }}>Подсказка</div>
          <h3>Говори в настоящем</h3>
          <p className="body">«Когда я в этом режиме – я чувствую…» работает лучше, чем абстрактные описания.</p>
        </div>
        <button className="ex-btn ex-btn-ghost" onClick={() => setPicked(null)} style={{ padding: '8px 12px' }}><GlyphArrowLeft /> Сменить режим</button>
      </>}
    >
      <FlashcardFlow questions={MODE_QUESTIONS} accentColor={picked.color} onSave={async data => { await api.saveModeNote({ modeId: picked.id, ...data }); onComplete?.(); }} />
    </ExScreen>
  );
}
