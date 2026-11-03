import { useNavigate } from 'react-router-dom';

// Вызов 2FA живёт 5 минут; протухший код не примет, сколько его ни вводи.
// Экран до входа: формы обращения ещё нет, поэтому текст безличный.
export function TwoFactorExpired() {
  const navigate = useNavigate();
  return (
    <div className="al-form" role="alert">
      <p className="al-error">Вход устарел: на ввод кода есть 5 минут. Здесь код уже не подойдёт – нужно войти заново.</p>
      <button type="button" className="al-submit" onClick={() => navigate('/login', { replace: true })}>
        Войти заново
      </button>
    </div>
  );
}
