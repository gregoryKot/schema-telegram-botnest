import { useState, useEffect } from 'react';
import { ExScreen, GlyphCheck } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { haptic } from '../../haptic';
import { ModeTestScreen } from './ModeTestScreen';
import { ModeEntryForm, type ModeFormFields } from './ModeEntryForm';

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
    healthyResponse?: string;
  }) => Promise<void>;
}

type DraftData = {
  modeId: string; situation: string; thoughts: string;
  feelings: string; bodyFeelings: string; actions: string;
  actualNeed: string; childhoodMemories: string; healthyResponse: string;
};

export function ModeEntrySheet({ onClose, onSave }: Props) {
  const tr = useTr();
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
  const [healthyResponse, setHealthyResponse] = useState(d?.healthyResponse ?? '');
  const [saving, setSaving]       = useState(false);
  const [showPicker, setShowPicker] = useState(!d?.modeId);
  const [testOpen, setTestOpen]   = useState(false);
  const [listOpen, setListOpen]   = useState(false);

  const pickMode = (id: string) => {
    haptic.select();
    setModeId(id);
    setShowPicker(false);
    setTestOpen(false);
  };

  useEffect(() => {
    saveDraft('mode', { modeId, situation, thoughts, feelings, bodyFeelings, actions, actualNeed, childhoodMemories, healthyResponse });
  }, [modeId, situation, thoughts, feelings, bodyFeelings, actions, actualNeed, childhoodMemories, healthyResponse]);

  const selectedMode = modeId
    ? MODE_GROUPS.flatMap(g => g.items.map(m => ({ ...m, color: g.color, groupName: g.group }))).find(m => m.id === modeId)
    : null;

  const canSave = modeId.length > 0 && situation.trim().length > 0;

  const values: ModeFormFields = { situation, thoughts, feelings, bodyFeelings, actions, actualNeed, childhoodMemories };
  const setters: Record<keyof ModeFormFields, (v: string) => void> = {
    situation: setSituation, thoughts: setThoughts, feelings: setFeelings,
    bodyFeelings: setBodyFeelings, actions: setActions, actualNeed: setActualNeed,
    childhoodMemories: setChildhoodMemories,
  };
  const setField = (k: keyof ModeFormFields, v: string) => setters[k](v);

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
        healthyResponse: healthyResponse || undefined,
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
    // Тест «определим по чувству» — отдельный экран (ModeTestScreen).
    if (testOpen) {
      return <ModeTestScreen onPick={pickMode} onBack={() => setTestOpen(false)} />;
    }
    return (
      <ExScreen
        onBack={goBack}
        backLabel="Назад к дневнику"
        eyebrow="Дневник режимов · новая запись"
        eyebrowColor="var(--c-slate)"
        title={<>Кто сейчас<br /><span className="it">взял управление?</span></>}
        lede={tr('Режим – состояние, которое сейчас «за рулём». Не знаешь названия – определим по чувству, в пару тапов.', 'Режим – состояние, которое сейчас «за рулём». Не знаете названия – определим по чувству, в пару тапов.')}
        aside={
          <div className="aside-card" style={{ borderColor: 'var(--c-slate)40', background: 'var(--c-slate)08' }}>
            <div className="aside-card-eyebrow" style={{ color: 'var(--c-slate)' }}>Подсказка</div>
            <h3>Как его узнать</h3>
            <p className="body">Режим узнаётся не по мыслям, а по тому, как меняется тело и тон голоса в голове. Замечай резкие переключения – это его след.</p>
          </div>
        }
      >
        {/* Главное действие: тест по чувству */}
        <button
          type="button"
          className="mode-test-cta"
          onClick={() => { haptic.select(); setTestOpen(true); }}
        >
          <span className="mode-test-cta-emoji">🧭</span>
          <span className="mode-test-cta-text">
            <span className="mode-test-cta-title">{tr('Не знаешь, какой режим?', 'Не знаете, какой режим?')}</span>
            <span className="mode-test-cta-sub">Определим по чувству – пара тапов</span>
          </span>
        </button>

        {/* Вторичное: полный список для тех, кто знает режим */}
        <button
          type="button"
          className="ex-btn ex-btn-ghost mode-list-toggle"
          onClick={() => { haptic.tap(); setListOpen(v => !v); }}
        >
          {listOpen ? 'Скрыть список' : 'Знаю режим – выбрать из списка'}
        </button>

        {listOpen && MODE_GROUPS.map(g => (
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
                {...pressable(() => pickMode(m.id))}
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
  return (
    <ModeEntryForm
      selectedMode={selectedMode ?? null}
      modeId={modeId}
      values={values}
      set={setField}
      healthyResponse={healthyResponse}
      setHealthyResponse={setHealthyResponse}
      saving={saving}
      canSave={canSave}
      onSave={handleSave}
      onBack={goBack}
      onChangeMode={() => setShowPicker(true)}
    />
  );
}
