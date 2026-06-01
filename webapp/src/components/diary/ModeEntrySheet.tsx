import { useState, useEffect } from 'react';
import { ExScreen, GlyphArrowLeft, GlyphCheck } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { haptic } from '../../haptic';

interface Props {
  onClose: () => void;
  onSave: (data: {
    modeId: string;
    situation: string;
    thoughts?: string;
    feelings?: string;
    bodyFeelings?: string;
    actions?: string;
    actualNeed?: string;
    childhoodMemories?: string;
  }) => Promise<void>;
}

type DraftData = {
  modeId: string; situation: string; thoughts: string;
  feelings: string; bodyFeelings: string; actions: string;
  actualNeed: string; childhoodMemories: string;
};

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const goBack = useHistorySheet(onClose);
  const existing = loadDraft<DraftData>('mode');
  const d = existing?.data;

  const [modeId, setModeId]     = useState(d?.modeId ?? '');
  const [situation, setSituation] = useState(d?.situation ?? '');
  const [thoughts, setThoughts]   = useState(d?.thoughts ?? '');
  const [feelings, setFeelings]   = useState(d?.feelings ?? '');
  const [bodyFeelings, setBodyFeelings] = useState(d?.bodyFeelings ?? '');
  const [actions, setActions]     = useState(d?.actions ?? '');
  const [actualNeed, setActualNeed] = useState(d?.actualNeed ?? '');
  const [childhoodMemories, setChildhoodMemories] = useState(d?.childhoodMemories ?? '');
  const [saving, setSaving]       = useState(false);
  const [showPicker, setShowPicker] = useState(!d?.modeId);

  useEffect(() => {
    saveDraft('mode', { modeId, situation, thoughts, feelings, bodyFeelings, actions, actualNeed, childhoodMemories });
  }, [modeId, situation, thoughts, feelings, bodyFeelings, actions, actualNeed, childhoodMemories]);

  const selectedMode = modeId
    ? MODE_GROUPS.flatMap(g => g.items.map(m => ({ ...m, color: g.color, groupName: g.group }))).find(m => m.id === modeId)
    : null;

  const canSave = modeId.length > 0 && situation.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    haptic.success();
    setSaving(true);
    try {
      await onSave({
        modeId, situation,
        thoughts: thoughts || undefined,
        feelings: feelings || undefined,
        bodyFeelings: bodyFeelings || undefined,
        actions: actions || undefined,
        actualNeed: actualNeed || undefined,
        childhoodMemories: childhoodMemories || undefined,
      });
      clearDraft('mode');
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
      goBack();
    }
  };

  // ── Step 1: picker ──
  if (!modeId || showPicker) {
    return (
      <ExScreen
        onBack={goBack}
        backLabel="Назад к дневнику"
        eyebrow="Дневник режимов · новая запись"
        eyebrowColor="var(--c-slate)"
        title={<>Кто сейчас<br /><span className="it">взял управление?</span></>}
        lede="Выбери режим – состояние, которое сейчас включено. Если не уверен – выбери самый похожий."
        aside={
          <div className="aside-card" style={{ borderColor: 'var(--c-slate)40', background: 'var(--c-slate)08' }}>
            <div className="aside-card-eyebrow" style={{ color: 'var(--c-slate)' }}>Подсказка</div>
            <h3>Как его узнать</h3>
            <p className="body">Режим узнаётся не по мыслям, а по тому, как меняется тело и тон голоса в голове. Замечай резкие переключения – это его след.</p>
          </div>
        }
      >
        {MODE_GROUPS.map(g => (
          <div key={g.id} style={{ marginBottom: 28 }}>
            <div className="chip-section-eyebrow" style={{ color: g.color }}>
              <span className="dot" style={{ background: g.color }} />
              {g.group}
            </div>
            {g.items.map(m => (
              <div
                key={m.id}
                className={'mode-card ' + (modeId === m.id ? 'is-selected' : '')}
                style={{ '--mode-color': g.color } as React.CSSProperties}
                onClick={() => { haptic.select(); setModeId(m.id); setShowPicker(false); }}
              >
                <span className="mode-card-stripe" />
                <div>
                  <div className="mode-card-name">{m.name}</div>
                  <div className="mode-card-short">{m.short}</div>
                </div>
                <span className="mode-check"><GlyphCheck /></span>
              </div>
            ))}
          </div>
        ))}
      </ExScreen>
    );
  }

  // ── Step 2: form ──
  const modeColor = selectedMode?.color ?? 'var(--c-slate)';
  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к дневнику"
      eyebrow={selectedMode?.groupName ?? 'Режим'}
      eyebrowColor={modeColor}
      title={selectedMode?.name ?? ''}
      lede={selectedMode?.short ?? ''}
      aside={
        <>
          <div className="aside-card" style={{ borderColor: modeColor + '40', background: modeColor + '08', position: 'sticky', top: 40 }}>
            <div className="aside-card-eyebrow" style={{ color: modeColor }}>Подсказка</div>
            <h3>Говори от лица режима</h3>
            <p className="body">«Этот режим говорит мне…», «Он чувствует…». Так легче увидеть его как часть, а не отождествлять себя с ним целиком.</p>
          </div>
          <button className="ex-btn ex-btn-ghost" onClick={() => setShowPicker(true)} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GlyphArrowLeft /> Сменить режим
          </button>
        </>
      }
    >
      <div className="prompt" style={{ marginTop: 8 }}>
        <div className="prompt-num">1.</div>
        <div>
          <div className="prompt-label">Что случилось <span style={{ color: 'var(--c-rose)', marginLeft: 2 }}>*</span></div>
          <p className="prompt-hint">Что включило этот режим – конкретно, без обобщений.</p>
          <textarea
            className={'paper-input ' + (situation.trim() ? 'is-filled' : '')}
            rows={3}
            value={situation}
            onChange={e => setSituation(e.target.value)}
            placeholder="Папа позвонил, начал спрашивать про работу. Почувствовал как «отключился»…"
            autoFocus
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">2.</div>
        <div>
          <div className="prompt-label">Что говорит этот режим</div>
          <p className="prompt-hint">Внутренний монолог – что он повторяет, во что верит.</p>
          <textarea
            className={'paper-input ' + (thoughts.trim() ? 'is-filled' : '')}
            rows={2}
            value={thoughts}
            onChange={e => setThoughts(e.target.value)}
            placeholder="«Не лезь. Не показывай. Никому не интересно по-настоящему»…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">3.</div>
        <div>
          <div className="prompt-label">Что он чувствует</div>
          <p className="prompt-hint">Эмоции этого режима – даже если он сам их «не чувствует».</p>
          <textarea
            className={'paper-input ' + (feelings.trim() ? 'is-filled' : '')}
            rows={2}
            value={feelings}
            onChange={e => setFeelings(e.target.value)}
            placeholder="Пустота, отрешённость. Под этим – обида и страх…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">4.</div>
        <div>
          <div className="prompt-label">Тело</div>
          <textarea
            className={'paper-input ' + (bodyFeelings.trim() ? 'is-filled' : '')}
            rows={2}
            value={bodyFeelings}
            onChange={e => setBodyFeelings(e.target.value)}
            placeholder="Тяжесть в груди, голос становится плоским, плечи сводит…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">5.</div>
        <div>
          <div className="prompt-label">Что он тебя тянет сделать</div>
          <textarea
            className={'paper-input ' + (actions.trim() ? 'is-filled' : '')}
            rows={2}
            value={actions}
            onChange={e => setActions(e.target.value)}
            placeholder="Закончить разговор быстрее. Лечь и листать ленту…"
          />
        </div>
      </div>

      <div className="flow-section-head">
        <span className="flow-section-num">·</span>
        <div>
          <div className="flow-section-title">Под режимом</div>
          <div className="flow-section-sub">За каждым режимом – настоящая потребность, которой он не умеет напрямую попросить.</div>
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">6.</div>
        <div>
          <div className="prompt-label">Чего на самом деле нужно</div>
          <p className="prompt-hint">Не режиму – тебе. Чего не хватает в этот момент.</p>
          <textarea
            className={'paper-input ' + (actualNeed.trim() ? 'is-filled' : '')}
            rows={2}
            value={actualNeed}
            onChange={e => setActualNeed(e.target.value)}
            placeholder="Чтобы папа спросил как я, а не как работа…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">7.</div>
        <div>
          <div className="prompt-label">Откуда это знакомо</div>
          <p className="prompt-hint">Из детства? Похожее чувство, похожая ситуация?</p>
          <textarea
            className={'paper-input ' + (childhoodMemories.trim() ? 'is-filled' : '')}
            rows={2}
            value={childhoodMemories}
            onChange={e => setChildhoodMemories(e.target.value)}
            placeholder="Когда мама приходила с работы – я уже знал что лучше не лезть…"
          />
        </div>
      </div>

      <div className="ex-foot">
        <span style={{ fontSize: 12, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 3, background: 'var(--c-moss)' }} />
          Автосохранение
        </span>
        <span className="spacer" />
        <button
          className="ex-btn ex-btn-primary"
          disabled={!canSave || saving}
          onClick={handleSave}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {saving ? 'Сохраняю…' : 'Сохранить запись'}
          {!saving && <GlyphCheck />}
        </button>
      </div>
    </ExScreen>
  );
}
