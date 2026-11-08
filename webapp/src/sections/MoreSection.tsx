import { useState } from 'react';
import type { Section } from '../components/appShell/navigation';
import { JourneySheet } from '../components/JourneySheet';
import { WhySheet } from '../components/WhySheet';
import { HomeScreenOfferCard } from '../components/HomeScreenOfferCard';
import { TherapyNudgeCard } from '../components/therapy/TherapyNudgeCard';
import { trackHomeTile } from './today/trackHomeTile';
import { useTodayDiaries } from './today/useTodayDiaries';
import { HomeTherapyLine } from './more/HomeTherapyLine';
import { useMoreRows } from './more/useMoreRows';
import { MoreRows } from './more/MoreRows';
import { TasksHub } from './tasks/TasksHub';
import { useTasksSheet } from './tasks/tasksLaunch';
import { CaseFlowHost } from '../components/caseFlow/CaseFlowHost';
import { CrisisContactsSheet } from './practice/CrisisContactsSheet';
import '../styles/client-more.css';
import { Heart } from '../components/art/PaperArtSigns';

interface Props {
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs' | 'schemas' | 'modes'; highlight?: string }) => void;
  onOpenAdvanced: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
  refreshKey?: number;
  onTasksChanged?: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

// «Ещё»: всё, что не входит в три действия главной (docs/design/CLIENT_SIMPLE_2026-10.md).
// Владелец 2026-11-05: на главной только три кнопки — сюда переехали задания (строка
// «Задания» → TasksHub), сигнальная карточка моста к терапевту, предложение поставить
// значок на экран и строка «самопомощь, не замена терапии». Кризисный вход — внизу:
// сразу лист с телефонами доверия (правило №7: не глубже одного нажатия; аудит 2026-11 —
// раньше вёл в «Практики», где контакты прятались за второй такой же строкой).
export function MoreSection(p: Props) {
  const [why, setWhy] = useState(false);
  const [journey, setJourney] = useState(false);
  const tasks = useTasksSheet(); // открывается и ссылкой из уведомления (tasksLaunch)
  const [selfMap, setSelfMap] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const { modeEntries } = useTodayDiaries(p.refreshKey);
  // Мост к терапевту терапевту не нужен. Роль из профиля приходит раньше кэша контакта
  // (therapy_is_therapist пишется после загрузки профиля), поэтому смотрим и на неё.
  const bridge = p.userRole !== 'THERAPIST';
  const { rows, sheet } = useMoreRows({
    ...p,
    onOpenWhy: () => { trackHomeTile('why'); setWhy(true); },
    onOpenJourney: () => setJourney(true),
    onOpenTasks: tasks.show,
    onOpenSelfMap: () => setSelfMap(true),
  });

  return (
    <div className="ds-page cm-page">
      <header className="pp-block pp-block--head cm-head">
        <div className="ds-eyebrow">Ещё</div>
        <h1 className="ds-h1">Всё остальное</h1>
      </header>

      {bridge && <TherapyNudgeCard refreshKey={p.refreshKey} modeEntries={modeEntries} />}

      <MoreRows rows={rows} />

      <button type="button" className="ds-card ds-card--row ds-card--nav ds-card--crisis ds-card--hover" onClick={() => setCrisis(true)}>
        <span className="pp-row-art"><Heart size="row" /></span>
        <span className="ds-list-title">Мне очень плохо</span>
        <span className="ds-chev" aria-hidden="true" />
      </button>

      <HomeScreenOfferCard />
      {bridge && <HomeTherapyLine />}

      {why && <WhySheet onClose={() => setWhy(false)} />}
      {crisis && <CrisisContactsSheet onClose={() => setCrisis(false)} />}
      {sheet}
      {journey && <JourneySheet onClose={() => setJourney(false)} />}
      {selfMap && (
        <CaseFlowHost start="map" onClose={() => setSelfMap(false)} onOpenTracker={p.onOpenTracker} onOpenSchema={p.onOpenSchema} />
      )}
      {tasks.open && (
        <TasksHub
          openTaskId={tasks.taskId}
          onClose={tasks.hide}
          onOpenTracker={p.onOpenTracker}
          onOpenDiaries={p.onOpenDiaries}
          onOpenChildhoodWheel={p.onOpenChildhoodWheel}
          refreshKey={p.refreshKey}
          onTasksChanged={p.onTasksChanged}
        />
      )}
    </div>
  );
}
