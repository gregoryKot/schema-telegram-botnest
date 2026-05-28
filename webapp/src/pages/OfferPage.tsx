export function OfferPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 40px 96px' }}>
        <a href="/" style={{ fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 48 }}>
          ← Назад
        </a>

        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>
          Последнее обновление: 28 мая 2025 г.
        </p>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 400, lineHeight: 1.1, margin: '0 0 12px', letterSpacing: '-.01em' }}>
          Публичная оферта
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 48px' }}>
          Оферта на оказание консультационных услуг в области психологического консультирования
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          <section>
            <h2 style={h2}>1. Исполнитель</h2>
            <p style={p}>
              Котляревский Григорий Сергеевич, практик в подходе схема-терапии, далее — «Исполнитель».
            </p>
            <p style={p}>Контакт: <a href="mailto:gregorykot@gmail.com" style={link}>gregorykot@gmail.com</a></p>
          </section>

          <section>
            <h2 style={h2}>2. Предмет оферты</h2>
            <p style={p}>
              Исполнитель оказывает Заказчику услуги психологического консультирования (далее — «консультации»)
              в формате индивидуальных онлайн-сессий с использованием подхода схема-терапии и когнитивно-поведенческой
              терапии (КПТ).
            </p>
            <p style={p}>
              Услуги не являются медицинской помощью, психиатрическим или психотерапевтическим лечением в смысле
              законодательства об охране здоровья граждан. При наличии показаний к медицинской помощи Исполнитель
              рекомендует обратиться к соответствующим специалистам.
            </p>
          </section>

          <section>
            <h2 style={h2}>3. Акцепт оферты</h2>
            <p style={p}>
              Акцептом (принятием) настоящей оферты является оплата консультации Заказчиком. Оплата означает полное
              и безоговорочное принятие условий оферты.
            </p>
          </section>

          <section>
            <h2 style={h2}>4. Стоимость и порядок оплаты</h2>
            <ul style={ul}>
              <li style={li}>Стоимость одной консультации — <strong>4 000 ₽</strong> (50 минут)</li>
              <li style={li}>Вводная встреча — <strong>бесплатно</strong> (15 минут)</li>
              <li style={li}>Порядок и реквизиты оплаты согласовываются индивидуально после записи</li>
              <li style={li}>Оплата производится до начала консультации, если иное не оговорено</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>5. Порядок оказания услуг</h2>
            <ul style={ul}>
              <li style={li}>Консультации проводятся онлайн в видеоформате (Zoom, Google Meet или другой согласованный сервис)</li>
              <li style={li}>Время и дата встречи согласовываются в переписке</li>
              <li style={li}>Продолжительность сессии — 50 минут</li>
              <li style={li}>Периодичность встреч определяется совместно в зависимости от запроса</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>6. Отмена и перенос</h2>
            <ul style={ul}>
              <li style={li}>Отмена или перенос консультации возможны не позднее чем за 24 часа до её начала — без штрафных санкций</li>
              <li style={li}>При отмене менее чем за 24 часа консультация считается проведённой и оплате не возвращается, если иное не оговорено Исполнителем</li>
              <li style={li}>Исполнитель оставляет за собой право перенести консультацию по уважительной причине с уведомлением Заказчика</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>7. Конфиденциальность</h2>
            <p style={p}>
              Исполнитель соблюдает профессиональную конфиденциальность. Информация, полученная в ходе консультаций,
              не разглашается третьим лицам без письменного согласия Заказчика, за исключением случаев, предусмотренных
              законодательством РФ.
            </p>
          </section>

          <section>
            <h2 style={h2}>8. Ограничение ответственности</h2>
            <p style={p}>
              Психологическое консультирование предполагает активное участие Заказчика. Исполнитель не гарантирует
              конкретного результата, так как он во многом определяется готовностью и усилиями самого клиента.
              Исполнитель несёт ответственность за добросовестное и профессиональное оказание услуг в рамках
              своей квалификации.
            </p>
          </section>

          <section>
            <h2 style={h2}>9. Применимое право</h2>
            <p style={p}>
              Настоящая оферта регулируется законодательством Российской Федерации. Споры разрешаются путём
              переговоров, при невозможности — в порядке, установленном действующим законодательством РФ.
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
