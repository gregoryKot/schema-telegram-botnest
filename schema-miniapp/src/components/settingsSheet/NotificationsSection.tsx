import { UserSettings } from '../../api';
import { botUrl, botHandle } from '../../utils/botConfig';
import { Row, Toggle, RowRight, SectionHeader } from './ui';
import {
  TIMEZONES,
  FREQ_LABELS,
  pad,
  quietLabel,
  hourInQuiet,
} from './constants';
import { View } from './types';

interface Props {
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<void>;
  setView: (view: View) => void;
  onInfo: () => void;
}

export function NotificationsSection({
  settings,
  patch,
  setView,
  onInfo,
}: Props) {
  const localHour = settings.notifyLocalHour;
  const tzLabel =
    TIMEZONES.find((t) => t.iana === settings.notifyTimezone)?.label ??
    settings.notifyTimezone;

  return (
    <div style={{ marginBottom: 8 }}>
      <SectionHeader onInfo={onInfo}>УВЕДОМЛЕНИЯ</SectionHeader>
      {settings.notifyPausedUntil &&
        new Date(settings.notifyPausedUntil) > new Date() && (
          <div
            className="card"
            style={{
              borderRadius: 16,
              padding: '12px 16px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
              ⏸ Уведомления на паузе до{' '}
              {new Date(settings.notifyPausedUntil).toLocaleDateString('ru-RU')}
            </div>
            <button
              onClick={() =>
                patch({
                  notifyPausedUntil: null,
                })
              }
              style={{
                background:
                  'color-mix(in srgb, var(--accent) 15%, transparent)',
                border: 'none',
                borderRadius: 10,
                padding: '7px 14px',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Возобновить
            </button>
          </div>
        )}
      <div
        className="card"
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <Row
          label="Итоги дня"
          sub="Ежедневный отчёт по потребностям"
          right={
            <Toggle
              on={settings.notifyEnabled}
              onClick={() => patch({ notifyEnabled: !settings.notifyEnabled })}
            />
          }
        />
        <Row
          label="Напоминание"
          sub="Заполнить трекер вечером"
          right={
            <Toggle
              on={!!settings.notifyReminderEnabled}
              onClick={() =>
                patch({
                  notifyReminderEnabled: !settings.notifyReminderEnabled,
                })
              }
            />
          }
          divider
        />
        {(settings.notifyEnabled || settings.notifyReminderEnabled) && (
          <>
            <Row
              label="Время"
              right={<RowRight text={`${pad(localHour)}:00`} />}
              onClick={() => setView('time')}
              divider
            />
            <Row
              label="Частота"
              right={
                <RowRight
                  text={FREQ_LABELS[settings.notifyFrequency ?? 0]}
                  small
                />
              }
              onClick={() => setView('freq')}
              divider
            />
            <Row
              label="Игровой режим"
              sub="Серии и «ещё день до вехи»"
              right={
                <Toggle
                  on={!!settings.notifyGamified}
                  onClick={() =>
                    patch({
                      notifyGamified: !settings.notifyGamified,
                    })
                  }
                />
              }
              divider
            />
            <Row
              label="Тихие часы"
              right={
                <RowRight
                  text={quietLabel(
                    settings.notifyQuietStart,
                    settings.notifyQuietEnd,
                  )}
                  small
                />
              }
              onClick={() => setView('quiet')}
              divider
            />
            <Row
              label="Часовой пояс"
              right={<RowRight text={tzLabel} small />}
              onClick={() => setView('tz')}
              divider
            />
          </>
        )}
      </div>
      {(settings.notifyEnabled || settings.notifyReminderEnabled) &&
        hourInQuiet(
          localHour,
          settings.notifyQuietStart,
          settings.notifyQuietEnd,
        ) && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent-yellow, #eab308)',
              lineHeight: 1.5,
              marginBottom: 8,
              padding: '0 4px',
            }}
          >
            Время уведомления попадает в тихие часы — сообщение придёт после их
            окончания
          </div>
        )}
      {(settings.notifyEnabled || settings.notifyReminderEnabled) && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
            marginBottom: 8,
            padding: '0 4px',
          }}
        >
          Приходят через{' '}
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            {botHandle}
          </a>
        </div>
      )}
    </div>
  );
}
