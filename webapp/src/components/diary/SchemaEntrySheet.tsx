import { useState, useEffect, useRef } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { EMOTIONS, INTENSITY_LABELS, SCHEMA_DOMAINS } from '../../schemaTherapyData';
import type { EmotionEntry } from '../../types';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { haptic } from '../../haptic';
import { DiaryAutosaveFooter } from './DiaryAutosaveFooter';

interface Props {
  activeSchemaIds?: string[];
  onClose: () => void;
  onSave: (data: {
    trigger: string;
    emotions: EmotionEntry[];
    thoughts?: string;
    bodyFeelings?: string;
    actualBehavior?: string;
    schemaIds: string[];
    schemaOrigin?: string;
    healthyView?: string;
    realProblems?: string;
    excessiveReactions?: string;
    healthyBehavior?: string;
  }) => Promise<void>;
}

interface DraftData {
  trigger: string;
  emotions: EmotionEntry[];
  thoughts: string;
  bodyFeelings: string;
  actualBehavior: string;
  schemaIds: string[];
  schemaOrigin: string;
  healthyView: string;
  realProblems: string;
  excessiveReactions: string;
  healthyBehavior: string;
}

export function SchemaEntrySheet({ activeSchemaIds, onClose, onSave }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const existing = loadDraft<DraftData>('schema');
  const draft = existing?.data ?? null;

  const [trigger, setTrigger] = useState(draft?.trigger ?? '');
  const [emotions, setEmotions] = useState<EmotionEntry[]>(draft?.emotions ?? []);
  const [thoughts, setThoughts] = useState(draft?.thoughts ?? '');
  const [bodyFeelings, setBodyFeelings] = useState(draft?.bodyFeelings ?? '');
  const [actualBehavior, setActualBehavior] = useState(draft?.actualBehavior ?? '');
  const [schemaIds, setSchemaIds] = useState<string[]>(draft?.schemaIds ?? []);
  const [schemaOrigin, setSchemaOrigin] = useState(draft?.schemaOrigin ?? '');
  const [healthyView, setHealthyView] = useState(draft?.healthyView ?? '');
  const [realProblems, setRealProblems] = useState(draft?.realProblems ?? '');
  const [excessiveReactions] = useState(draft?.excessiveReactions ?? '');
  const [healthyBehavior, setHealthyBehavior] = useState(draft?.healthyBehavior ?? '');
  const [saving, setSaving] = useState(false);
  const [showAllSchemas, setShowAllSchemas] = useState(false);
  const triggerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { triggerRef.current?.focus(); }, []);

  const hasPersonalSchemas = activeSchemaIds && activeSchemaIds.length > 0;
  const useFiltered = hasPersonalSchemas && !showAllSchemas;

  useEffect(() => {
    const data: DraftData = {
      trigger, emotions, thoughts, bodyFeelings, actualBehavior,
      schemaIds, schemaOrigin, healthyView, realProblems, excessiveReactions, healthyBehavior,
    };
    saveDraft('schema', data);
  }, [trigger, emotions, thoughts, bodyFeelings, actualBehavior, schemaIds, schemaOrigin, healthyView, realProblems, excessiveReactions, healthyBehavior]);

  const toggleEmotion = (id: string) => {
    haptic.select();
    setEmotions(prev => prev.find(e => e.id === id) ? prev.filter(e => e.id !== id) : [...prev, { id, intensity: 3 }]);
  };

  const setIntensity = (id: string, intensity: number) => {
    haptic.select();
    setEmotions(prev => prev.map(e => e.id === id ? { ...e, intensity } : e));
  };

  const toggleSchema = (id: string) => {
    haptic.select();
    setSchemaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const canSave = trigger.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    haptic.success();
    setSaving(true);
    try {
      await onSave({
        trigger, emotions,
        thoughts: thoughts || undefined,
        bodyFeelings: bodyFeelings || undefined,
        actualBehavior: actualBehavior || undefined,
        schemaIds,
        schemaOrigin: schemaOrigin || undefined,
        healthyView: healthyView || undefined,
        realProblems: realProblems || undefined,
        excessiveReactions: excessiveReactions || undefined,
        healthyBehavior: healthyBehavior || undefined,
      });
      clearDraft('schema');
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
      goBack();
    }
  };

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к дневнику"
      eyebrow="Дневник схем · новая запись"
      eyebrowColor="var(--c-rose)"
      title={<>Записать<br /><span className="it">момент</span></>}
      lede="Поймал триггер – приходи сюда. Десять полей, заполняй сколько успеешь. Обязательное только первое."
      aside={
        <div className="aside-card" style={{ borderColor: 'var(--c-rose)40', background: 'var(--c-rose)08', position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color: 'var(--c-rose)' }}>Совет</div>
          <h3>Не обязательно по порядку</h3>
          <p className="body">{tr('Если в моменте трудно – запиши только триггер и чувство. Остальное можно дополнить позже, или когда тебе кто-то поможет это разобрать.', 'Если в моменте трудно – запишите только триггер и чувство. Остальное можно дополнить позже, или когда вам кто-то поможет это разобрать.')}</p>
          <ul>
            <li>Автосохранение каждые 5 сек</li>
            <li>Можно вернуться и продолжить</li>
            <li>{tr('Никто кроме тебя не увидит', 'Никто кроме вас не увидит')}</li>
          </ul>
        </div>
      }
    >
      {/* ─── I. Что случилось ─── */}
      <div className="flow-section-head first">
        <span className="flow-section-num">I.</span>
        <div>
          <div className="flow-section-title">Что случилось</div>
          <div className="flow-section-sub">{tr('Внешняя сторона события – ситуация, чувства, тело, твоя реакция.', 'Внешняя сторона события – ситуация, чувства, тело, ваша реакция.')}</div>
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">1.</div>
        <div>
          <div className="prompt-label">{tr('Опиши ситуацию', 'Опишите ситуацию')} <span style={{ color: 'var(--c-rose)', marginLeft: 2 }}>*</span></div>
          <p className="prompt-hint">Что произошло? Где, с кем, в какой момент. Конкретно – не обобщай.</p>
          <textarea
            ref={triggerRef}
            className={'paper-input ' + (trigger.trim() ? 'is-filled' : '')}
            rows={3}
            value={trigger}
            onChange={e => setTrigger(e.target.value)}
            placeholder="Например: на созвоне А. сказал что мой ппт «слабо проработан»…"
          />
        </div>
      </div>

      <div className="field-block" style={{ marginTop: 32 }}>
        <div className="prompt-label" style={{ fontSize: 22, marginBottom: 6 }}>Что поднялось внутри</div>
        <p className="field-block-hint">{tr('Выбери одно или несколько – потом отметь интенсивность.', 'Выберите одно или несколько – потом отметьте интенсивность.')}</p>
        <div className="chip-row">
          {EMOTIONS.map(em => {
            const sel = emotions.find(e => e.id === em.id);
            return (
              <button
                key={em.id}
                className={'chip-pill ' + (sel ? 'is-selected' : '')}
                onClick={() => toggleEmotion(em.id)}
              >
                {em.label}
              </button>
            );
          })}
        </div>
        {emotions.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            {emotions.map(em => {
              const meta = EMOTIONS.find(e => e.id === em.id)!;
              return (
                <div key={em.id} className="intensity" style={{ '--int-color': 'var(--c-rose)' } as React.CSSProperties}>
                  <span className="intensity-name">{meta.label}</span>
                  <div className="intensity-bar">
                    {INTENSITY_LABELS.map((lbl, i) => (
                      <div
                        key={i}
                        className={'intensity-step ' + (em.intensity >= i + 1 ? 'is-on' : '')}
                        {...pressable(() => setIntensity(em.id, i + 1))}
                        title={lbl}
                      />
                    ))}
                  </div>
                  <span className="intensity-label">{INTENSITY_LABELS[em.intensity - 1]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="prompt" style={{ marginTop: 32 }}>
        <div className="prompt-num">3.</div>
        <div>
          <div className="prompt-label">Мысли</div>
          <p className="prompt-hint">Что говоришь себе? Какие фразы повторяются в голове?</p>
          <textarea
            className={'paper-input ' + (thoughts.trim() ? 'is-filled' : '')}
            rows={2}
            value={thoughts}
            onChange={e => setThoughts(e.target.value)}
            placeholder="«Опять облажался. Все думают что я не справляюсь»…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">4.</div>
        <div>
          <div className="prompt-label">Тело</div>
          <p className="prompt-hint">Где это ощущается физически? Сжатие, тяжесть, пульс, дыхание.</p>
          <textarea
            className={'paper-input ' + (bodyFeelings.trim() ? 'is-filled' : '')}
            rows={2}
            value={bodyFeelings}
            onChange={e => setBodyFeelings(e.target.value)}
            placeholder="Ком в горле, плечи как камни, дыхание перехватило…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">5.</div>
        <div>
          <div className="prompt-label">Моя реакция</div>
          <p className="prompt-hint">Что сделал или хотел сделать? Убежать, замолчать, накричать, заесть.</p>
          <textarea
            className={'paper-input ' + (actualBehavior.trim() ? 'is-filled' : '')}
            rows={2}
            value={actualBehavior}
            onChange={e => setActualBehavior(e.target.value)}
            placeholder="Замолчала. Не смогла дочитать свою часть. Дома легла и листала ленту…"
          />
        </div>
      </div>

      {/* ─── II. Какая схема ─── */}
      <div className="flow-section-head">
        <span className="flow-section-num">II.</span>
        <div>
          <div className="flow-section-title">Какая схема сработала</div>
          <div className="flow-section-sub">{tr('Найди под ситуацией знакомый паттерн. Он не «правда о тебе» – это привычка.', 'Найдите под ситуацией знакомый паттерн. Он не «правда о вас» – это привычка.')}</div>
        </div>
      </div>

      <div className="field-block">
        {SCHEMA_DOMAINS.map(domain => {
          const schemas = useFiltered
            ? domain.schemas.filter(s => activeSchemaIds?.includes(s.id) ?? false)
            : domain.schemas;
          if (schemas.length === 0) return null;
          return (
            <div key={domain.id} style={{ marginBottom: 18 }}>
              <div className="chip-section-eyebrow" style={{ color: domain.color }}>
                <span className="dot" style={{ background: domain.color }} />
                {domain.domain}
              </div>
              <div className="chip-row" style={{ marginBottom: 0 }}>
                {schemas.map(s => {
                  const sel = schemaIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      className={'chip-pill ' + (sel ? 'is-selected' : '')}
                      style={sel ? {
                        '--pill-color': domain.color + '15',
                        '--pill-fg': domain.color,
                        '--pill-border': domain.color + '50',
                      } as React.CSSProperties : undefined}
                      onClick={() => toggleSchema(s.id)}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {hasPersonalSchemas && (
          <button onClick={() => { haptic.tap(); setShowAllSchemas(v => !v); }} style={{
            background: 'none', border: 'none', color: 'var(--text-sub)',
            fontSize: 12, cursor: 'pointer', padding: '4px 0', marginBottom: 8,
          }}>
            {showAllSchemas ? '↑ Только мои' : '↓ Показать все'}
          </button>
        )}
      </div>

      <div className="prompt" style={{ marginTop: 16 }}>
        <div className="prompt-num">7.</div>
        <div>
          <div className="prompt-label">Откуда это знакомо</div>
          <p className="prompt-hint">Похоже на что-то из прошлого? Из детства? Из других похожих ситуаций?</p>
          <textarea
            className={'paper-input ' + (schemaOrigin.trim() ? 'is-filled' : '')}
            rows={2}
            value={schemaOrigin}
            onChange={e => setSchemaOrigin(e.target.value)}
            placeholder="Так папа в детстве оценивал мои оценки – никогда не было достаточно…"
          />
        </div>
      </div>

      {/* ─── III. Здоровый взгляд ─── */}
      <div className="flow-section-head">
        <span className="flow-section-num">III.</span>
        <div>
          <div className="flow-section-title">Здоровый взгляд</div>
          <div className="flow-section-sub">{tr('Не «всё хорошо» – а более точно. Что Здоровый Взрослый сказал бы на твоём месте.', 'Не «всё хорошо» – а более точно. Что Здоровый Взрослый сказал бы на вашем месте.')}</div>
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">8.</div>
        <div>
          <div className="prompt-label">Если убрать схему – что происходит</div>
          <textarea
            className={'paper-input ' + (healthyView.trim() ? 'is-filled' : '')}
            rows={2}
            value={healthyView}
            onChange={e => setHealthyView(e.target.value)}
            placeholder="Андрей дал критику, как и другим. Это про работу, не про меня…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">9.</div>
        <div>
          <div className="prompt-label">Что реально трудно</div>
          <p className="prompt-hint">Без раздувания – что в этом моменте по-настоящему сложно?</p>
          <textarea
            className={'paper-input ' + (realProblems.trim() ? 'is-filled' : '')}
            rows={2}
            value={realProblems}
            onChange={e => setRealProblems(e.target.value)}
            placeholder="Получать критику при всех – это правда некомфортно…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">10.</div>
        <div>
          <div className="prompt-label">Что сделал бы Здоровый Взрослый</div>
          <textarea
            className={'paper-input ' + (healthyBehavior.trim() ? 'is-filled' : '')}
            rows={2}
            value={healthyBehavior}
            onChange={e => setHealthyBehavior(e.target.value)}
            placeholder="Спросил бы Андрея конкретно что улучшить. Дома сделал бы себе чай вместо ленты…"
          />
        </div>
      </div>

      {detectCrisisAny(trigger, thoughts, bodyFeelings, actualBehavior, schemaOrigin, healthyView, realProblems, excessiveReactions, healthyBehavior) && <CrisisCard />}

      <DiaryAutosaveFooter canSave={canSave} saving={saving} onSave={handleSave} />
    </ExScreen>
  );
}
