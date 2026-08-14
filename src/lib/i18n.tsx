import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { writeLangCookie } from "@/lib/lang-cookie";

export type Lang = "en" | "ru" | "uz";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
  { code: "uz", label: "UZ" },
];

/** Local fallbacks — admins can override any of these from Admin → Translations. */
export const DEFAULT_STRINGS: Record<string, Record<Lang, string>> = {
  "nav.home": { en: "Home", ru: "Главная", uz: "Bosh sahifa" },
  "nav.shop": { en: "Shop", ru: "Магазин", uz: "Do'kon" },
  "nav.about": { en: "About", ru: "О нас", uz: "Biz haqimizda" },
  "nav.contact": { en: "Contact", ru: "Контакты", uz: "Aloqa" },
  "common.addToCart": { en: "Add to Cart", ru: "В корзину", uz: "Savatga" },
  "common.viewAll": { en: "View all", ru: "Смотреть все", uz: "Barchasini ko'rish" },
  "common.search": { en: "Search products", ru: "Поиск товаров", uz: "Mahsulot qidirish" },
  "common.checkout": { en: "Checkout", ru: "Оформить заказ", uz: "Buyurtma berish" },
  "common.continue": { en: "Continue", ru: "Продолжить", uz: "Davom etish" },
  "common.back": { en: "Back", ru: "Назад", uz: "Orqaga" },
  "common.loading": { en: "Loading…", ru: "Загрузка…", uz: "Yuklanmoqda…" },
  "cart.title": { en: "Your Cart", ru: "Ваша корзина", uz: "Savatingiz" },
  "cart.empty": { en: "Your cart is empty", ru: "Ваша корзина пуста", uz: "Savatingiz bo'sh" },
  "cart.subtotal": { en: "Subtotal", ru: "Подытог", uz: "Jami" },
  "cart.remove": { en: "Remove", ru: "Удалить", uz: "O'chirish" },
  "shop.title": { en: "Shop", ru: "Магазин", uz: "Do'kon" },
  "shop.filters": { en: "Filters", ru: "Фильтры", uz: "Filtrlar" },
  "shop.category": { en: "Category", ru: "Категория", uz: "Kategoriya" },
  "shop.size": { en: "Size", ru: "Размер", uz: "O'lcham" },
  "shop.color": { en: "Color", ru: "Цвет", uz: "Rang" },
  "shop.price": { en: "Price", ru: "Цена", uz: "Narx" },
  "shop.sort": { en: "Sort by", ru: "Сортировка", uz: "Saralash" },
  "shop.all": { en: "All", ru: "Все", uz: "Barchasi" },
  "shop.newest": { en: "Newest", ru: "Новинки", uz: "Yangi" },
  "shop.popular": { en: "Most popular", ru: "Популярные", uz: "Mashhur" },
  "shop.priceLow": { en: "Price: low to high", ru: "Цена: по возрастанию", uz: "Narx: o'sish" },
  "shop.priceHigh": { en: "Price: high to low", ru: "Цена: по убыванию", uz: "Narx: kamayish" },
  "shop.inStock": { en: "In stock", ru: "В наличии", uz: "Mavjud" },
  "shop.outOfStock": { en: "Out of stock", ru: "Нет в наличии", uz: "Tugagan" },
  "shop.related": {
    en: "You may also like",
    ru: "Вам также понравится",
    uz: "Sizga yoqishi mumkin",
  },
  "shop.quantity": { en: "Quantity", ru: "Количество", uz: "Miqdor" },
  "shop.empty": {
    en: "No products match your filters",
    ru: "Товары не найдены",
    uz: "Mahsulot topilmadi",
  },
  "checkout.customer": {
    en: "Customer details",
    ru: "Данные покупателя",
    uz: "Xaridor ma'lumotlari",
  },
  "checkout.delivery": { en: "Delivery", ru: "Доставка", uz: "Yetkazib berish" },
  "checkout.payment": { en: "Payment", ru: "Оплата", uz: "To'lov" },
  "checkout.confirm": { en: "Confirmation", ru: "Подтверждение", uz: "Tasdiqlash" },
  "checkout.name": { en: "Full name", ru: "Имя и фамилия", uz: "To'liq ism" },
  "checkout.phone": { en: "Phone", ru: "Телефон", uz: "Telefon" },
  "checkout.email": { en: "Email", ru: "Эл. почта", uz: "Email" },
  "checkout.address": {
    en: "Delivery address",
    ru: "Адрес доставки",
    uz: "Yetkazib berish manzili",
  },
  "checkout.pin": {
    en: "Drag the pin to your exact location",
    ru: "Перетащите метку на точное место",
    uz: "Belgini aniq manzilingizga suring",
  },
  "checkout.pay": { en: "Pay now", ru: "Оплатить", uz: "To'lash" },
  "checkout.thanks": {
    en: "Thank you for your order",
    ru: "Спасибо за заказ",
    uz: "Buyurtmangiz uchun rahmat",
  },
  "about.since": { en: "Since 2019", ru: "С 2019 года", uz: "2019 yildan beri" },
  "about.pillar1.title": {
    en: "Made in small runs",
    ru: "Малые партии",
    uz: "Kichik partiyalarda",
  },
  "about.pillar1.body": {
    en: "Every style is cut in limited quantities so nothing is wasted and every seam is checked by hand.",
    ru: "Каждая модель шьётся ограниченным тиражом: ничего не пропадает, а каждый шов проверяется вручную.",
    uz: "Har bir model cheklangan miqdorda tikiladi — hech narsa isrof bo'lmaydi, har bir tik qo'lda tekshiriladi.",
  },
  "about.pillar2.title": { en: "Natural fabrics", ru: "Натуральные ткани", uz: "Tabiiy matolar" },
  "about.pillar2.body": {
    en: "Silk, wool, linen and cotton sourced from mills we visit in person, chosen for how they age.",
    ru: "Шёлк, шерсть, лён и хлопок с фабрик, которые мы посещаем лично, выбранные за то, как они стареют.",
    uz: "Ipak, jun, zig'ir va paxta — o'zimiz borib ko'rgan fabrikalardan, yillar o'tishi bilan qanday ko'rinishiga qarab tanlangan.",
  },
  "about.pillar3.title": { en: "Designed to last", ru: "Создано надолго", uz: "Uzoq yillarga" },
  "about.pillar3.body": {
    en: "Timeless silhouettes in a soft rose palette — pieces you'll return to season after season.",
    ru: "Вневременные силуэты в мягкой розовой палитре — вещи, к которым возвращаешься сезон за сезоном.",
    uz: "Yumshoq pushti palitradagi zamon o'tmas siluetlar — mavsumdan mavsumga qaytadigan buyumlar.",
  },
  "about.cta": {
    en: "Wear something made with care",
    ru: "Носите то, что создано с заботой",
    uz: "Mehr bilan yaratilgan kiyimni kiying",
  },
  "shop.loadMore": { en: "Load more", ru: "Показать ещё", uz: "Yana ko'rsatish" },
  "shop.chooseOptions": {
    en: "Choose size",
    ru: "Выбрать размер",
    uz: "O'lchamni tanlash",
  },
  "shop.pickSize": { en: "Choose a size", ru: "Выберите размер", uz: "O'lchamni tanlang" },
  "shop.pickColor": { en: "Choose a colour", ru: "Выберите цвет", uz: "Rangni tanlang" },
  "shop.variantOut": {
    en: "This size and colour is sold out",
    ru: "Этот размер и цвет распроданы",
    uz: "Bu o'lcham va rang tugagan",
  },
  "shop.left": { en: "left", ru: "осталось", uz: "qoldi" },
  "shop.freeDeliveryOver": {
    en: "Free delivery over",
    ru: "Бесплатная доставка от",
    uz: "Bepul yetkazish:",
  },
  "home.badge": {
    en: "Autumn Atelier 2026",
    ru: "Осенний ателье 2026",
    uz: "Kuzgi atelye 2026",
  },
  "home.smallRuns": {
    en: "Made in small runs",
    ru: "Малые партии",
    uz: "Kichik partiyalarda",
  },
  "home.worldwide": {
    en: "Worldwide delivery",
    ru: "Доставка по миру",
    uz: "Butun dunyo bo'ylab yetkazish",
  },
  "home.happy": {
    en: "12k happy women",
    ru: "12 тыс. довольных женщин",
    uz: "12 ming mamnun ayol",
  },
  "home.atelierSince": {
    en: "Atelier since 2019",
    ru: "Ателье с 2019 года",
    uz: "2019 yildan beri atelye",
  },
  "home.handFinished": {
    en: "Hand finished",
    ru: "Ручная отделка",
    uz: "Qo'lda pardozlangan",
  },
  "home.yearsValue": {
    en: "7 yrs",
    ru: "7 лет",
    uz: "7 yil",
  },
  "home.yearsLabel": {
    en: "of atelier craft",
    ru: "мастерства ателье",
    uz: "atelye mahorati",
  },
  "home.readStory": {
    en: "Read our story",
    ru: "Читать нашу историю",
    uz: "Hikoyamizni o'qing",
  },
  "home.collections": {
    en: "Collections",
    ru: "Коллекции",
    uz: "Kolleksiyalar",
  },
  "home.shopByCategory": {
    en: "Shop by category",
    ru: "Покупки по категориям",
    uz: "Kategoriya bo'yicha xarid",
  },
  "home.newArrivals": {
    en: "New arrivals",
    ru: "Новинки",
    uz: "Yangi kelganlar",
  },
  "home.justLanded": {
    en: "Just landed",
    ru: "Только поступило",
    uz: "Endigina keldi",
  },
  "home.bestSellers": {
    en: "Best sellers",
    ru: "Хиты продаж",
    uz: "Eng ko'p sotilgan",
  },
  "home.lovedMost": {
    en: "Loved most this season",
    ru: "Любимое в этом сезоне",
    uz: "Bu mavsum sevimlisi",
  },
  "home.lookbook": {
    en: "Lookbook",
    ru: "Лукбук",
    uz: "Lukbuk",
  },
  "home.ctaTitle": {
    en: "Dress the way you feel",
    ru: "Одевайтесь так, как чувствуете",
    uz: "O'zingizni his qilgandek kiyining",
  },
  "home.ctaBody": {
    en: "Explore the full atelier — new pieces are released in limited runs every month.",
    ru: "Загляните в ателье — новые модели выходят ограниченным тиражом каждый месяц.",
    uz: "Atelyeni ko'ring — har oy cheklangan miqdorda yangi buyumlar chiqadi.",
  },
  "shop.eyebrow": {
    en: "Atelier",
    ru: "Ателье",
    uz: "Atelye",
  },
  "shop.pieces": {
    en: "pieces, cut in small runs and finished by hand.",
    ru: "моделей, сшитых малыми партиями и отделанных вручную.",
    uz: "ta buyum — kichik partiyalarda tikilgan, qo'lda pardozlangan.",
  },
  "shop.upTo": {
    en: "Up to",
    ru: "До",
    uz: "Gacha",
  },
  "shop.clearFilters": {
    en: "Clear filters",
    ru: "Сбросить фильтры",
    uz: "Filtrlarni tozalash",
  },
  "shop.sale": {
    en: "Sale",
    ru: "Скидка",
    uz: "Chegirma",
  },
  "shop.notFound": {
    en: "Piece not found",
    ru: "Товар не найден",
    uz: "Buyum topilmadi",
  },
  "shop.notFoundBody": {
    en: "This item may have sold out or been retired.",
    ru: "Возможно, товар распродан или снят с продажи.",
    uz: "Bu buyum sotilib ketgan yoki savdodan olingan bo'lishi mumkin.",
  },
  "shop.freeDelivery": {
    en: "Free delivery over $200",
    ru: "Бесплатная доставка от $200",
    uz: "$200 dan yuqori bepul yetkazish",
  },
  "shop.returns": {
    en: "14-day easy returns",
    ru: "Лёгкий возврат 14 дней",
    uz: "14 kun ichida oson qaytarish",
  },
  "cart.summary": {
    en: "Summary",
    ru: "Сводка",
    uz: "Xulosa",
  },
  "cart.shipping": {
    en: "Shipping",
    ru: "Доставка",
    uz: "Yetkazib berish",
  },
  "cart.free": {
    en: "Free",
    ru: "Бесплатно",
    uz: "Bepul",
  },
  "cart.total": {
    en: "Total",
    ru: "Итого",
    uz: "Jami",
  },
  "checkout.order": {
    en: "Order",
    ru: "Заказ",
    uz: "Buyurtma",
  },
  "checkout.note": {
    en: "Order note (optional)",
    ru: "Комментарий (необязательно)",
    uz: "Izoh (ixtiyoriy)",
  },
  "checkout.toDelivery": {
    en: "Continue to delivery",
    ru: "К доставке",
    uz: "Yetkazishga o'tish",
  },
  "checkout.toPayment": {
    en: "Continue to payment",
    ru: "К оплате",
    uz: "To'lovga o'tish",
  },
  "checkout.pinnedAt": {
    en: "Pinned at",
    ru: "Отмечено",
    uz: "Belgilangan",
  },
  "checkout.demoNote": {
    en: "Demo payment — no real card is charged.",
    ru: "Демо-оплата — реальная карта не списывается.",
    uz: "Demo to'lov — haqiqiy kartadan pul yechilmaydi.",
  },
  "checkout.approved": {
    en: "Approved",
    ru: "Одобрена",
    uz: "Tasdiqlanadi",
  },
  "checkout.declined": {
    en: "Declined",
    ru: "Отклонена",
    uz: "Rad etiladi",
  },
  "checkout.cardNumber": {
    en: "Card number",
    ru: "Номер карты",
    uz: "Karta raqami",
  },
  "checkout.cardName": {
    en: "Name on card",
    ru: "Имя на карте",
    uz: "Kartadagi ism",
  },
  "checkout.expiry": {
    en: "Expiry (MM/YY)",
    ru: "Срок (ММ/ГГ)",
    uz: "Amal qilish (OO/YY)",
  },
  "checkout.cvc": {
    en: "CVC",
    ru: "CVC",
    uz: "CVC",
  },
  "checkout.authorising": {
    en: "Authorising…",
    ru: "Авторизация…",
    uz: "Tasdiqlanmoqda…",
  },
  "checkout.placing": {
    en: "Placing your order…",
    ru: "Оформляем заказ…",
    uz: "Buyurtma rasmiylashtirilmoqda…",
  },
  "checkout.totalPaid": {
    en: "Total paid",
    ru: "Оплачено",
    uz: "To'langan",
  },
  "checkout.nextSteps": {
    en: "We'll call you shortly to confirm delivery to your pinned location. Your pieces are reserved — stock has already been set aside for you.",
    ru: "Мы свяжемся с вами, чтобы подтвердить доставку по отмеченному адресу. Ваши вещи уже зарезервированы.",
    uz: "Belgilangan manzilga yetkazishni tasdiqlash uchun tez orada qo'ng'iroq qilamiz. Buyumlaringiz siz uchun ajratib qo'yildi.",
  },
  "checkout.method": { en: "Payment method", ru: "Способ оплаты", uz: "To'lov usuli" },
  "checkout.methodCard": { en: "Card (demo)", ru: "Карта (демо)", uz: "Karta (demo)" },
  "checkout.methodCod": {
    en: "Cash on delivery",
    ru: "Наличными при получении",
    uz: "Yetkazib berganda naqd",
  },
  "checkout.codNote": {
    en: "Pay the courier in cash when your order arrives.",
    ru: "Оплатите курьеру наличными при получении заказа.",
    uz: "Buyurtma yetib kelganda kuryerga naqd to'laysiz.",
  },
  "checkout.codConfirm": {
    en: "We'll call you shortly to confirm delivery. Please have the cash ready for the courier — your pieces are already reserved.",
    ru: "Мы позвоним, чтобы подтвердить доставку. Подготовьте наличные для курьера — товары уже зарезервированы.",
    uz: "Yetkazishni tasdiqlash uchun tez orada qo'ng'iroq qilamiz. Kuryerga naqd pulni tayyorlab qo'ying — buyumlar ajratib qo'yildi.",
  },
  "checkout.placeOrder": { en: "Place order", ru: "Оформить заказ", uz: "Buyurtma berish" },
  "track.title": { en: "Track your order", ru: "Отследить заказ", uz: "Buyurtmani kuzatish" },
  "track.body": {
    en: "Enter your order number and phone to see where it is.",
    ru: "Введите номер заказа и телефон, чтобы узнать статус.",
    uz: "Holatini bilish uchun buyurtma raqami va telefonni kiriting.",
  },
  "track.orderNumber": { en: "Order number", ru: "Номер заказа", uz: "Buyurtma raqami" },
  "track.check": { en: "Check", ru: "Проверить", uz: "Tekshirish" },
  "track.notFound": {
    en: "No order matches that number and phone.",
    ru: "Заказ с такими данными не найден.",
    uz: "Bunday raqam va telefon bo'yicha buyurtma topilmadi.",
  },
  "status.pending": { en: "Pending", ru: "В обработке", uz: "Kutilmoqda" },
  "status.processing": { en: "Processing", ru: "Собирается", uz: "Tayyorlanmoqda" },
  "status.shipped": { en: "Shipped", ru: "Отправлен", uz: "Yo'lga chiqdi" },
  "status.delivered": { en: "Delivered", ru: "Доставлен", uz: "Yetkazildi" },
  "status.cancelled": { en: "Cancelled", ru: "Отменён", uz: "Bekor qilindi" },
  "legal.offer": { en: "Public offer", ru: "Публичная оферта", uz: "Ommaviy oferta" },
  "legal.privacy": {
    en: "Privacy policy",
    ru: "Политика конфиденциальности",
    uz: "Maxfiylik siyosati",
  },
  "legal.returns": { en: "Returns", ru: "Возврат товара", uz: "Tovarni qaytarish" },
  "legal.updated": { en: "Last updated", ru: "Обновлено", uz: "Yangilangan" },
  "legal.heading": { en: "Legal", ru: "Правовая информация", uz: "Huquqiy ma'lumot" },
  "auth.studioPassword": { en: "Studio password", ru: "Пароль студии", uz: "Studio paroli" },
  "auth.studioHint": {
    en: "Enter the shop password to open the studio.",
    ru: "Введите пароль магазина, чтобы войти в студию.",
    uz: "Studioga kirish uchun do'kon parolini kiriting.",
  },
  "auth.wrongPassword": {
    en: "That password doesn't open the studio.",
    ru: "Этот пароль не подходит.",
    uz: "Bu parol studioni ochmaydi.",
  },
  "footer.explore": {
    en: "Explore",
    ru: "Навигация",
    uz: "Bo'limlar",
  },
  "footer.contact": {
    en: "Contact",
    ru: "Контакты",
    uz: "Aloqa",
  },
  "footer.blurb": {
    en: "Yesmine is a small-run womenswear house: rose silk, soft wool and hand-finished satin, made by women for women.",
    ru: "Yesmine — дом женской одежды малыми партиями: розовый шёлк, мягкая шерсть и атлас ручной отделки, созданные женщинами для женщин.",
    uz: "Yesmine — kichik partiyalarda ayollar kiyimi uyi: pushti ipak, yumshoq jun va qo'lda pardozlangan atlas, ayollar tomonidan ayollar uchun.",
  },
  "footer.rights": {
    en: "All rights reserved.",
    ru: "Все права защищены.",
    uz: "Barcha huquqlar himoyalangan.",
  },
  "contact.eyebrow": {
    en: "Say hello",
    ru: "Напишите нам",
    uz: "Salom ayting",
  },
  "contact.title": {
    en: "Contact the atelier",
    ru: "Связаться с ателье",
    uz: "Atelye bilan bog'lanish",
  },
  "contact.body": {
    en: "Styling appointments, sizing advice, order questions or wholesale — we read every message.",
    ru: "Подбор образа, вопросы по размеру и заказам, опт — мы читаем каждое сообщение.",
    uz: "Uslub bo'yicha maslahat, o'lcham va buyurtma savollari, ulgurji — har bir xabarni o'qiymiz.",
  },
  "contact.name": {
    en: "Your name",
    ru: "Ваше имя",
    uz: "Ismingiz",
  },
  "contact.message": {
    en: "Message",
    ru: "Сообщение",
    uz: "Xabar",
  },
  "contact.send": {
    en: "Send message",
    ru: "Отправить",
    uz: "Xabar yuborish",
  },
  "contact.sent": {
    en: "Thank you — the atelier will reply within one business day.",
    ru: "Спасибо — ателье ответит в течение одного рабочего дня.",
    uz: "Rahmat — atelye bir ish kuni ichida javob beradi.",
  },
  "contact.openMaps": {
    en: "Open in maps",
    ru: "Открыть на карте",
    uz: "Xaritada ochish",
  },
  "contact.recentre": {
    en: "Recentre on the studio",
    ru: "Вернуться к студии",
    uz: "Studiyaga qaytish",
  },
  "newsletter.invalid": {
    en: "Please enter a valid email address",
    ru: "Введите корректный email",
    uz: "To'g'ri email kiriting",
  },
  "newsletter.done": {
    en: "You're on the list — welcome to Yesmine.",
    ru: "Вы подписаны — добро пожаловать в Yesmine.",
    uz: "Ro'yxatdasiz — Yesmine'ga xush kelibsiz.",
  },
  "marquee.silk": { en: "Silk", ru: "Шёлк", uz: "Ipak" },
  "marquee.handFinished": { en: "Hand-finished", ru: "Ручная отделка", uz: "Qo'lda pardozlangan" },
  "marquee.smallRuns": { en: "Small runs", ru: "Малые партии", uz: "Kichik partiyalar" },
  "marquee.roseTones": { en: "Rose tones", ru: "Розовые оттенки", uz: "Pushti ranglar" },
  "marquee.madeByWomen": { en: "Made by women", ru: "Создано женщинами", uz: "Ayollar tomonidan" },
  "footer.newsletter": {
    en: "Join the Yesmine letter",
    ru: "Подпишитесь на рассылку Yesmine",
    uz: "Yesmine xatiga qo'shiling",
  },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "yesmine.lang";

export function I18nProvider({
  children,
  initialLang = "en",
}: {
  children: ReactNode;
  /** Read from the request cookie, so the server renders the right language. */
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeLangCookie(l);
    // Kept in step for anything still reading the old key.
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  // A visitor who chose a language before cookies were used still has it in
  // localStorage; move it across once so their choice is not lost.
  useEffect(() => {
    if (document.cookie.includes(`${STORAGE_KEY}=`)) return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved) && saved !== lang) setLang(saved);
  }, [lang, setLang]);

  const { data: remote } = useQuery({
    queryKey: ["translations"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("translations").select("key,en,ru,uz");
      if (error) throw error;
      return data ?? [];
    },
  });

  const table = useMemo(() => {
    const merged: Record<string, Record<Lang, string>> = { ...DEFAULT_STRINGS };
    for (const row of remote ?? []) {
      merged[row.key] = {
        en: row.en || DEFAULT_STRINGS[row.key]?.en || row.key,
        ru: row.ru || DEFAULT_STRINGS[row.key]?.ru || "",
        uz: row.uz || DEFAULT_STRINGS[row.key]?.uz || "",
      };
    }
    return merged;
  }, [remote]);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const entry = table[key];
      if (!entry) return fallback ?? key;
      return entry[lang] || entry.en || fallback || key;
    },
    [table, lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Picks the right localized field from a record shaped like { name_en, name_ru, name_uz }. */
export function localized<T extends Record<string, unknown>>(
  row: T,
  base: string,
  lang: Lang,
): string {
  const value = row[`${base}_${lang}`];
  if (typeof value === "string" && value.trim()) return value;
  const fallback = row[`${base}_en`];
  return typeof fallback === "string" ? fallback : "";
}
