import type { RefObject } from 'react';
import { ExScreen, GlyphArrowLeft } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { DiaryAutosaveFooter } from './DiaryAutosaveFooter';

// Шаг 2 дневника режимов: 7-полевая форма разбора режима. Вынесено из
// ModeEntrySheet (лимит размера файла, CLAUDE.md правило №10). Контент шагов
// 2+ не менялся — только относокация. Состояние живёт в родителе (автосейв
// черновика, кризисная детекция, сохранение).

export interface ModeFormFields {
  situation: string; thoughts: string; feelings: string; bodyFeelings: string;
  actions: string; actualNeed: string; childhoodMemories: string;
}

type FieldKey = keyof ModeFormFields;

interface Props {
  selectedMode: { name: string; short: string; color: string; groupName: string } | null;
  values: ModeFormFields;
  set: (key: FieldKey, value: string) => void;
  situationRef: RefObject<HTMLTextAreaElement | null>;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onBack: () => void;
  onChangeMode: () => void;
}

export function ModeEntryForm({ selectedMode, values, set, situationRef, saving, canSave, onSave, onBack, onChangeMode }: Props) {
  const tr = useTr();
  const modeColor = selectedMode?.color ?? 'var(--c-slate)';
  const v = values;

  return (
    <ExScreen
      onBack={onBack}
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
          <button className="ex-btn ex-btn-ghost" onClick={onChangeMode} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
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
            ref={situationRef}
            className={'paper-input ' + (v.situation.trim() ? 'is-filled' : '')}
            rows={3}
            value={v.situation}
            onChange={e => set('situation', e.target.value)}
            placeholder="Папа позвонил, начал спрашивать про работу. Почувствовал как «отключился»…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">2.</div>
        <div>
          <div className="prompt-label">Что говорит этот режим</div>
          <p className="prompt-hint">Внутренний монолог – что он повторяет, во что верит.</p>
          <textarea
            className={'paper-input ' + (v.thoughts.trim() ? 'is-filled' : '')}
            rows={2}
            value={v.thoughts}
            onChange={e => set('thoughts', e.target.value)}
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
            className={'paper-input ' + (v.feelings.trim() ? 'is-filled' : '')}
            rows={2}
            value={v.feelings}
            onChange={e => set('feelings', e.target.value)}
            placeholder="Пустота, отрешённость. Под этим – обида и страх…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">4.</div>
        <div>
          <div className="prompt-label">Тело</div>
          <textarea
            className={'paper-input ' + (v.bodyFeelings.trim() ? 'is-filled' : '')}
            rows={2}
            value={v.bodyFeelings}
            onChange={e => set('bodyFeelings', e.target.value)}
            placeholder="Тяжесть в груди, голос становится плоским, плечи сводит…"
          />
        </div>
      </div>

      <div className="prompt">
        <div className="prompt-num">5.</div>
        <div>
          <div className="prompt-label">{tr('Что он тебя тянет сделать', 'Что он вас тянет сделать')}</div>
          <textarea
            className={'paper-input ' + (v.actions.trim() ? 'is-filled' : '')}
            rows={2}
            value={v.actions}
            onChange={e => set('actions', e.target.value)}
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
          <p className="prompt-hint">{tr('Не режиму – тебе. Чего не хватает в этот момент.', 'Не режиму – вам. Чего не хватает в этот момент.')}</p>
          <textarea
            className={'paper-input ' + (v.actualNeed.trim() ? 'is-filled' : '')}
            rows={2}
            value={v.actualNeed}
            onChange={e => set('actualNeed', e.target.value)}
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
            className={'paper-input ' + (v.childhoodMemories.trim() ? 'is-filled' : '')}
            rows={2}
            value={v.childhoodMemories}
            onChange={e => set('childhoodMemories', e.target.value)}
            placeholder="Когда мама приходила с работы – я уже знал что лучше не лезть…"
          />
        </div>
      </div>

      {detectCrisisAny(v.situation, v.thoughts, v.feelings, v.bodyFeelings, v.actions, v.actualNeed, v.childhoodMemories) && <CrisisCard surface="mode" />}

      <DiaryAutosaveFooter canSave={canSave} saving={saving} onSave={onSave} />
    </ExScreen>
  );
}
