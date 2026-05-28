export function PrivacyPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 40px 96px' }}>
        <a href="/" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 48 }}>
          ← Назад
        </a>

        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>
          Последнее обновление: 28 мая 2025 г.
        </p>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 400, lineHeight: 1.1, margin: '0 0 48px', letterSpacing: '-.01em' }}>
          Политика конфиденциальности
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          <section>
            <h2 style={h2}>1. Оператор персональных данных</h2>
            <p style={p}>
              Оператором персональных данных является Котляревский Григорий Сергеевич (далее — «Оператор», «я»),
              осуществляющий деятельность по оказанию услуг психологического консультирования через сайт{' '}
              <a href="https://schemalab.ru" style={link}>schemalab.ru</a>.
            </p>
            <p style={p}>Контактный адрес: <a href="mailto:gregorykot@gmail.com" style={link}>gregorykot@gmail.com</a></p>
          </section>

          <section>
            <h2 style={h2}>2. Какие данные собираются</h2>
            <p style={p}>При заполнении формы записи на консультацию я собираю:</p>
            <ul style={ul}>
              <li style={li}>Имя (обязательно)</li>
              <li style={li}>Контактные данные: номер телефона или Telegram-username (обязательно)</li>
              <li style={li}>Текст запроса — краткое описание темы, с которой вы хотите обратиться (по желанию)</li>
            </ul>
            <p style={p}>
              При использовании веб-приложения СхемаЛаб дополнительно могут обрабатываться данные, которые вы вносите
              самостоятельно: оценки состояний, дневниковые записи, результаты опросников. Эти данные хранятся
              в зашифрованном виде.
            </p>
          </section>

          <section>
            <h2 style={h2}>3. Цели обработки</h2>
            <ul style={ul}>
              <li style={li}>Организация и проведение консультаций (ответ на заявку, согласование времени встречи)</li>
              <li style={li}>Ведение учёта оказанных услуг</li>
              <li style={li}>Предоставление доступа к веб-приложению СхемаЛаб</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>4. Правовое основание обработки</h2>
            <p style={p}>
              Обработка персональных данных осуществляется на основании вашего согласия (п. 1 ч. 1 ст. 6 Федерального
              закона № 152-ФЗ «О персональных данных»). Заполняя форму записи и нажимая кнопку «Записаться», вы даёте
              согласие на обработку указанных персональных данных в целях, перечисленных выше.
            </p>
          </section>

          <section>
            <h2 style={h2}>5. Срок хранения</h2>
            <p style={p}>
              Данные хранятся до момента отзыва согласия, но не дольше 3 лет с даты последнего взаимодействия.
              После окончания срока хранения данные уничтожаются.
            </p>
          </section>

          <section>
            <h2 style={h2}>6. Передача третьим лицам</h2>
            <p style={p}>
              Персональные данные не передаются третьим лицам, не продаются и не используются в рекламных целях.
              Технические подрядчики (хостинг, инфраструктура) получают доступ только к обезличенным или зашифрованным
              данным в объёме, необходимом для работы сервиса.
            </p>
          </section>

          <section>
            <h2 style={h2}>7. Ваши права</h2>
            <p style={p}>В соответствии с ФЗ-152 вы вправе:</p>
            <ul style={ul}>
              <li style={li}>Получить информацию об обработке ваших данных</li>
              <li style={li}>Потребовать уточнения, блокировки или уничтожения данных</li>
              <li style={li}>Отозвать согласие на обработку в любой момент</li>
              <li style={li}>Обжаловать действия Оператора в Роскомнадзор</li>
            </ul>
            <p style={p}>
              Для реализации прав обратитесь по адресу:{' '}
              <a href="mailto:gregorykot@gmail.com" style={link}>gregorykot@gmail.com</a>. Запрос будет рассмотрен
              в течение 30 дней.
            </p>
          </section>

          <section>
            <h2 style={h2}>8. Cookie и аналитика</h2>
            <p style={p}>
              Сайт использует технические cookie, необходимые для авторизации и работы приложения. Сторонние
              аналитические сервисы, собирающие данные о поведении пользователей, не подключены.
            </p>
          </section>

          <section>
            <h2 style={h2}>9. Изменения политики</h2>
            <p style={p}>
              Политика может обновляться. Актуальная версия всегда доступна на этой странице. При существенных
              изменениях дата обновления в заголовке будет изменена.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

const h2: React.CSSProperties = {
  fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400,
  color: 'var(--text)', margin: '0 0 14px', letterSpacing: '-.01em',
};
const p: React.CSSProperties = {
  fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 12px',
};
const ul: React.CSSProperties = {
  margin: '0 0 12px', paddingLeft: 20,
};
const li: React.CSSProperties = {
  fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.8, marginBottom: 4,
};
const link: React.CSSProperties = {
  color: 'var(--accent)', textDecoration: 'none',
};
