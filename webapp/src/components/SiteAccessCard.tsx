import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHost } from '../../../shared/src/host';
import {
  isSiteLoginSnoozed,
  needsSiteLogin,
  snoozeSiteLogin,
} from '../../../shared/src/account/siteLoginOffer';
import { api } from '../api';
import { useAuth } from '../auth/authContext';
import { useAccountData } from '../pages/account/useAccountData';
import { useTr } from '../utils/addressForm';
import { EntitySheet } from './paper/EntitySheet';
import { EntryBrand } from './paper/EntryHead';
import { ENTRY_HUE } from './paper/entryLook';
import '../styles/sheet-tasks.css';

// Приглашение добавить почту или VK ID — только внутри Telegram и только тому,
// у кого других способов входа нет (shared/src/account/siteLoginOffer.ts). На
// сайт через Telegram с 2026-11 не входят: без второго способа человек не
// откроет ни сайт, ни приложение с экрана телефона. Карточка отвечает «откуда
// и зачем» прямо здесь, действие одно — на экран способов входа. Не блокирует:
// «Позже» прячет её на неделю, а с добавленным способом она исчезает сама.
export function SiteAccessCard() {
  // Вне Telegram способы входа не запрашиваем вовсе.
  return getHost().id === 'telegram' ? <Offer /> : null;
}

const track = (action: 'shown' | 'open' | 'later') =>
  api.trackEvent('login_method_offer', { action });

function Offer() {
  const tr = useTr();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { providers, loading } = useAccountData(accessToken);
  const [hidden, setHidden] = useState(() => isSiteLoginSnoozed());
  const visible =
    !hidden &&
    needsSiteLogin({
      providers: loading ? null : providers.map((p) => p.provider),
      hostId: 'telegram',
    });

  const shown = useRef(false);
  useEffect(() => {
    if (!visible || shown.current) return;
    shown.current = true;
    track('shown');
  }, [visible]);

  if (!visible) return null;
  return (
    <EntitySheet
      look={{ hue: ENTRY_HUE }}
      art={<EntryBrand />}
      title={tr('Добавь вход для сайта', 'Добавьте вход для сайта')}
      sub={tr(
        'Здесь, в Telegram, всё открывается как раньше. А на сайте и в приложении на экране телефона вход через Telegram закрыт — туда входят почтой или VK ID. Добавь один из них, и записи будут там же.',
        'Здесь, в Telegram, всё открывается как раньше. А на сайте и в приложении на экране телефона вход через Telegram закрыт — туда входят почтой или VK ID. Добавьте один из них, и записи будут там же.',
      )}
      className="hso-card ef-bare ef-art"
    >
      <div className="hso-actions">
        <button
          type="button"
          className="ds-btn"
          onClick={() => {
            track('open');
            navigate('/account');
          }}
        >
          Добавить почту или VK ID
        </button>
        <span className="hso-quiet">
          <button
            type="button"
            className="ds-link"
            onClick={() => {
              track('later');
              snoozeSiteLogin();
              setHidden(true);
            }}
          >
            Позже
          </button>
        </span>
      </div>
    </EntitySheet>
  );
}
