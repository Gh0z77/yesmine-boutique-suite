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
  "shop.related": { en: "You may also like", ru: "Вам также понравится", uz: "Sizga yoqishi mumkin" },
  "shop.quantity": { en: "Quantity", ru: "Количество", uz: "Miqdor" },
  "shop.empty": { en: "No products match your filters", ru: "Товары не найдены", uz: "Mahsulot topilmadi" },
  "checkout.customer": { en: "Customer details", ru: "Данные покупателя", uz: "Xaridor ma'lumotlari" },
  "checkout.delivery": { en: "Delivery", ru: "Доставка", uz: "Yetkazib berish" },
  "checkout.payment": { en: "Payment", ru: "Оплата", uz: "To'lov" },
  "checkout.confirm": { en: "Confirmation", ru: "Подтверждение", uz: "Tasdiqlash" },
  "checkout.name": { en: "Full name", ru: "Имя и фамилия", uz: "To'liq ism" },
  "checkout.phone": { en: "Phone", ru: "Телефон", uz: "Telefon" },
  "checkout.email": { en: "Email", ru: "Эл. почта", uz: "Email" },
  "checkout.address": { en: "Delivery address", ru: "Адрес доставки", uz: "Yetkazib berish manzili" },
  "checkout.pin": {
    en: "Drag the pin to your exact location",
    ru: "Перетащите метку на точное место",
    uz: "Belgini aniq manzilingizga suring",
  },
  "checkout.pay": { en: "Pay now", ru: "Оплатить", uz: "To'lash" },
  "checkout.thanks": { en: "Thank you for your order", ru: "Спасибо за заказ", uz: "Buyurtmangiz uchun rahmat" },
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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved)) setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

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
export function localized<T extends Record<string, unknown>>(row: T, base: string, lang: Lang): string {
  const value = row[`${base}_${lang}`];
  if (typeof value === "string" && value.trim()) return value;
  const fallback = row[`${base}_en`];
  return typeof fallback === "string" ? fallback : "";
}
