-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Bootstrap: first signed-in user can claim admin when no admin exists yet
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN public.has_role(uid,'admin');
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (uid,'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

-- Timestamps helper
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ru text NOT NULL DEFAULT '',
  name_uz text NOT NULL DEFAULT '',
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER categories_touch BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL DEFAULT 0,
  compare_price numeric(12,2),
  stock int NOT NULL DEFAULT 0,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sizes text[] NOT NULL DEFAULT '{}',
  colors text[] NOT NULL DEFAULT '{}',
  images text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  sold_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  note text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_ref text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders guest insert" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders admin read" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "orders admin update" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "orders admin delete" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  image_url text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1,
  size text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.order_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items guest insert" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order items admin read" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "order items admin write" ON public.order_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "order items admin delete" ON public.order_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Landing content
CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content public read" ON public.site_content FOR SELECT USING (true);
CREATE POLICY "content admin write" ON public.site_content FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Translations
CREATE TABLE public.translations (
  key text PRIMARY KEY,
  en text NOT NULL DEFAULT '',
  ru text NOT NULL DEFAULT '',
  uz text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translations TO authenticated;
GRANT ALL ON public.translations TO service_role;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translations public read" ON public.translations FOR SELECT USING (true);
CREATE POLICY "translations admin write" ON public.translations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Order number generator
CREATE SEQUENCE public.order_number_seq START 1001;
GRANT USAGE ON SEQUENCE public.order_number_seq TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.next_order_number() RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'YSM-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 4, '0')
$$;
GRANT EXECUTE ON FUNCTION public.next_order_number() TO anon, authenticated;

-- Seed categories
INSERT INTO public.categories (slug, name_en, name_ru, name_uz, sort_order, image_url) VALUES
 ('dresses','Dresses','Платья','Ko''ylaklar',1,'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80'),
 ('outerwear','Outerwear','Верхняя одежда','Ustki kiyim',2,'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900&q=80'),
 ('accessories','Accessories','Аксессуары','Aksessuarlar',3,'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=900&q=80'),
 ('new-arrivals','New Arrivals','Новинки','Yangi kelganlar',4,'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80');

-- Seed products
INSERT INTO public.products (slug,name,description,price,compare_price,stock,category_id,sizes,colors,images,featured,sold_count) VALUES
 ('rosewood-silk-maxi','Rosewood Silk Maxi Dress','A flowing silk maxi in deep rose, cut for movement with a softly draped waist and hand-finished hem.',189.00,229.00,14,(SELECT id FROM public.categories WHERE slug='dresses'),'{XS,S,M,L,XL}','{Rose,Blush,Ivory}','{https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=1000&q=80,https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=1000&q=80}',true,142),
 ('blush-satin-slip','Blush Satin Slip Dress','Bias-cut satin slip with adjustable straps and a whisper-light finish.',149.00,NULL,22,(SELECT id FROM public.categories WHERE slug='dresses'),'{XS,S,M,L}','{Blush,Black}','{https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=1000&q=80,https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=1000&q=80}',true,98),
 ('magenta-evening-gown','Magenta Evening Gown','Floor-length statement gown in vivid magenta crepe with a sculpted bodice.',329.00,399.00,7,(SELECT id FROM public.categories WHERE slug='dresses'),'{S,M,L}','{Magenta,Rose}','{https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=1000&q=80}',true,54),
 ('ivory-tea-dress','Ivory Tea Dress','Midi tea dress in crinkled cotton with covered buttons and a full sweep.',129.00,NULL,31,(SELECT id FROM public.categories WHERE slug='dresses'),'{XS,S,M,L,XL}','{Ivory,Blush}','{https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1000&q=80}',false,73),
 ('rose-wool-coat','Rose Wool Wrap Coat','Double-faced wool wrap coat with a tie belt and dropped shoulder.',389.00,459.00,9,(SELECT id FROM public.categories WHERE slug='outerwear'),'{S,M,L,XL}','{Rose,Camel}','{https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=1000&q=80,https://images.unsplash.com/photo-1608234808654-2a8875faa7fd?w=1000&q=80}',true,61),
 ('blush-trench','Blush Cotton Trench','Lightweight trench in blush cotton twill with storm flap and horn buttons.',269.00,NULL,16,(SELECT id FROM public.categories WHERE slug='outerwear'),'{XS,S,M,L}','{Blush,Ivory}','{https://images.unsplash.com/photo-1548624313-0396c75f8e73?w=1000&q=80}',false,44),
 ('quilted-rose-jacket','Quilted Rose Jacket','Cropped quilted jacket with satin lining and snap closure.',199.00,239.00,18,(SELECT id FROM public.categories WHERE slug='outerwear'),'{S,M,L}','{Rose,Black}','{https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=1000&q=80}',false,37),
 ('silk-rose-scarf','Silk Rose Scarf','Hand-rolled silk twill scarf printed with the Yesmine six-petal motif.',69.00,NULL,54,(SELECT id FROM public.categories WHERE slug='accessories'),'{ONE}','{Rose,Pink,Ivory}','{https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=1000&q=80}',true,211),
 ('petal-gold-earrings','Petal Gold Earrings','Six-petal drop earrings in gold vermeil, feather-light to wear.',89.00,109.00,40,(SELECT id FROM public.categories WHERE slug='accessories'),'{ONE}','{Gold,Rose Gold}','{https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1000&q=80}',false,163),
 ('rose-leather-belt','Rose Leather Belt','Slim Italian leather belt with a brushed rose-tone buckle.',79.00,NULL,29,(SELECT id FROM public.categories WHERE slug='accessories'),'{S,M,L}','{Rose,Black}','{https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=1000&q=80}',false,58),
 ('pleated-blush-skirt','Pleated Blush Midi Skirt','Sunray-pleated midi skirt with an elasticated satin waistband.',139.00,NULL,25,(SELECT id FROM public.categories WHERE slug='new-arrivals'),'{XS,S,M,L}','{Blush,Ivory}','{https://images.unsplash.com/photo-1583496661160-fb5886a13d77?w=1000&q=80}',true,29),
 ('rose-knit-set','Rose Knit Lounge Set','Fine-gauge knit top and wide-leg trouser set in a warm rose tone.',179.00,209.00,20,(SELECT id FROM public.categories WHERE slug='new-arrivals'),'{XS,S,M,L,XL}','{Rose,Blush}','{https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&q=80}',true,46);

-- Seed landing content
INSERT INTO public.site_content (key, value) VALUES
 ('hero','{"headline_en":"Softness, worn with power","headline_ru":"Нежность, носимая с силой","headline_uz":"Nazokat, kuch bilan kiyiladi","sub_en":"Yesmine dresses the modern woman in rose-toned silk, wool and satin — made in small runs, finished by hand.","sub_ru":"Yesmine одевает современную женщину в шелк, шерсть и сатин розовых оттенков — малые партии, ручная отделка.","sub_uz":"Yesmine zamonaviy ayolni pushti ipak, jun va atlasga o''raydi — kichik partiyalarda, qo''lda pardozlangan.","cta_en":"Shop Now","cta_ru":"В магазин","cta_uz":"Xarid qilish"}'::jsonb),
 ('about','{"title_en":"The Yesmine story","body_en":"Founded on the belief that femininity is a form of strength, Yesmine began with a single rose-silk dress cut on a kitchen table in Tashkent. Today every piece is still made in small runs, by women, for women.","image":"https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=1200&q=80"}'::jsonb),
 ('testimonials','[{"name":"Dilnoza R.","city":"Tashkent","text":"The silk maxi is the best-made dress I own. It photographs beautifully and feels even better."},{"name":"Marina K.","city":"Almaty","text":"Ordered the wool wrap coat and it arrived in four days, wrapped like a gift. Impeccable."},{"name":"Sofia A.","city":"Istanbul","text":"Yesmine understands proportion. Nothing needed altering — a first for me."}]'::jsonb),
 ('gallery','["https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80","https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80","https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=800&q=80","https://images.unsplash.com/photo-1509319117193-57bab727e09d?w=800&q=80","https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80","https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?w=800&q=80"]'::jsonb);

-- Seed translations
INSERT INTO public.translations (key,en,ru,uz) VALUES
 ('nav.home','Home','Главная','Bosh sahifa'),
 ('nav.shop','Shop','Магазин','Do''kon'),
 ('nav.about','About','О нас','Biz haqimizda'),
 ('nav.contact','Contact','Контакты','Aloqa'),
 ('common.addToCart','Add to Cart','В корзину','Savatga'),
 ('common.viewAll','View all','Смотреть все','Barchasini ko''rish'),
 ('common.search','Search products','Поиск товаров','Mahsulot qidirish'),
 ('common.checkout','Checkout','Оформить заказ','Buyurtma berish'),
 ('cart.title','Your Cart','Ваша корзина','Savatingiz'),
 ('cart.empty','Your cart is empty','Ваша корзина пуста','Savatingiz bo''sh'),
 ('cart.subtotal','Subtotal','Подытог','Jami'),
 ('shop.filters','Filters','Фильтры','Filtrlar'),
 ('shop.category','Category','Категория','Kategoriya'),
 ('shop.size','Size','Размер','O''lcham'),
 ('shop.color','Color','Цвет','Rang'),
 ('shop.price','Price','Цена','Narx'),
 ('shop.sort','Sort by','Сортировка','Saralash'),
 ('checkout.customer','Customer details','Данные покупателя','Xaridor ma''lumotlari'),
 ('checkout.delivery','Delivery','Доставка','Yetkazib berish'),
 ('checkout.payment','Payment','Оплата','To''lov'),
 ('checkout.confirm','Confirmation','Подтверждение','Tasdiqlash'),
 ('footer.newsletter','Join the Yesmine letter','Подпишитесь на рассылку Yesmine','Yesmine xatiga qo''shiling');