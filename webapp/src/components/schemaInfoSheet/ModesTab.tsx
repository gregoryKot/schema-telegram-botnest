import { useState, type CSSProperties } from 'react';
import { useTr } from '../../utils/addressForm';
import { SignHero } from '../paper/SignHero';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { buildModes } from './data';
import { glue } from '../../../../shared/src/utils/typo';
import { ModeCheckinOverlay } from './ModeCheckinOverlay';
import { ModesGroup } from './ModesGroup';

// Вкладка «режимы» справочника схем: чек-ин + режимы по группам (вынесено из SchemaInfoSheet,
// правило №10). Чек-ин — плитка бумаги режимов с Cluster; группы — ModesGroup: лист бумаги группы со
// знаком у подписи, «Поделиться» — в раскрытой строке, а не кнопкой у каждой из одиннадцати (аудит 2026-11).
export function ModesTab() {
  const tr = useTr();
  const [showCheckin, setShowCheckin] = useState(false);
  const [openMode, setOpenMode] = useState<string | null>(null);
  const modes = ENTITY_LOOK.modes;
  return (
    <div className="ss-pane">
      <button type="button" onClick={() => setShowCheckin(true)} className="pp-paper ss-checkin-cta" style={{ '--h': modes.hue } as CSSProperties}>
        <span className="ss-cta-text">
          <span className="ds-label ss-checkin-eyebrow">Режим прямо сейчас</span>
          <span className="ss-checkin-title">{glue(tr('Как ты себя чувствуешь? →', 'Как вы себя чувствуете? →'))}</span>
        </span>
        <span className="ss-checkin-sign" aria-hidden="true"><SignHero sign={modes.sign} /></span>
      </button>
      <p className="ss-body">Режим – это актуальное состояние психики прямо сейчас. Цель – расширить доступ к Здоровому Взрослому.</p>
      {buildModes(tr).map((g) => (
        <ModesGroup key={g.group} group={g} openMode={openMode} onToggle={(name) => setOpenMode(openMode === name ? null : name)} />
      ))}
      {showCheckin && <ModeCheckinOverlay onClose={() => setShowCheckin(false)} />}
    </div>
  );
}
