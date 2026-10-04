/* public/app/brands/registry.js — манифест брендов (данные, не код).
   Единственный источник брендового контента: логотип, тикер, чат, сплэш.
   Визуальные токены (цвета/геометрия) — public/app/ui/brand-tokens.css (СЛОЙ 2-данные).
   Правило: новый бренд = запись здесь + таблица токенов + ассеты, без правок компонентов. */
export const BRANDS = {
  coffee: {
    id: 'coffee',
    label: 'Кофейня',
    emoji: '🌊',
    tokensFrom: 'root',            /* палитра кофейни = :root дефолты theme-v2.css (СЛОЙ 1) */
    menuSection: 'coffee',         /* семантический флаг вместо brand === '...' (Фаза D) */
    loyalty: 'stamps',
    logo: { src: '/andCoffee.svg', w: 48, h: 48, alt: '…и кофе' },
    authLogo: { src: '/andCoffee.svg', box: 66, wide: false },
    ticker: [
      'кофейня на берегу моря …и кофе',
      'каждый 10-й кофе — бесплатно',
      'п. Янтарный, Советская 70г',
      't.me/and_coffee39',
      'ежедневно с 8:00–21:00'
    ],
    chat: {
      greet: 'Привет! Я Ника, поддержка кофейни «…и кофе» 🌊 Спрашивайте — или позовите сотрудника.',
      hints: ['Где вы и часы работы?', 'Как копить штампы?', 'Куда ввести промокод?']
    },
    splash: { title: 'Кофейня', sub: 'меню, штампы и бонусы' }
  },
  delivery: {
    id: 'delivery',
    label: 'Пятница',
    emoji: '🍕',
    tokensFrom: 'brand-tokens',
    menuSection: 'delivery',
    loyalty: 'gifts',
    /* Горизонтальный логотип: ТОЛЬКО SVG с явной пропорцией 4:1.
       Урок F5.39: квадратный webp-растр + object-fit:contain сжимал наклейку в полоску. */
    logo: { src: '/friday-logo.svg', w: 160, h: 40, alt: 'Пятница' },
    authLogo: { src: '/friday-logo.svg', box: 140, wide: true },
    ticker: [
      'Пятница — доставка пиццы и роллов',
      'Ежедневно 11:00–22:00',
      'Доставка ~45 мин',
      'vk.ru/fridaypizza39',
      'Каждые 2000 ₽ в чеке — 0,5 пива в подарок'
    ],
    chat: {
      greet: 'Привет! Я Ника, поддержка доставки «Пятница» 🍕 Спрашивайте — или позовите диспетчера.',
      hints: ['Зоны и стоимость доставки', 'Сколько ждать заказ?', 'Какие сейчас акции?', 'Где мой заказ?']
    },
    splash: { title: '«Пятница»', sub: 'доставка пиццы и роллов' }
  }
};

export function brandConfig(id) {
  return BRANDS[id] || BRANDS.coffee;
}

/* window-шим для легаси-потребителей и инлайн-скриптов (контракт F1.3) */
if (typeof window !== 'undefined') {
  window.BRANDS = BRANDS;
  window.brandConfig = brandConfig;
}