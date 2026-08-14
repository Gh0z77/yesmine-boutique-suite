-- Two additions the store needs to be usable by a real, non-technical owner:
--   1. Products carry RU/UZ copy, like categories already do, so the language
--      switcher translates the catalogue and not just the site chrome.
--   2. A media bucket, so the owner uploads photos from their phone instead of
--      hunting for image URLs to paste.

-- ---------------------------------------------------------------------------
-- 1. Product translations
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_ru text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS name_uz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_ru text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_uz text NOT NULL DEFAULT '';

UPDATE public.products p
   SET name_ru = t.name_ru,
       name_uz = t.name_uz,
       description_ru = t.description_ru,
       description_uz = t.description_uz
  FROM (VALUES
    ('rosewood-silk-maxi',
     'Шёлковое платье макси Rosewood',
     'Rosewood ipak maksi ko''ylak',
     'Струящееся шёлковое платье макси глубокого розового оттенка, свободный крой, мягко драпированная талия и подшитый вручную низ.',
     'To''q pushti rangdagi oqib turuvchi ipak maksi ko''ylak — erkin bichim, yumshoq yig''ilgan bel va qo''lda tikilgan etak.'),
    ('blush-satin-slip',
     'Атласное платье-комбинация Blush',
     'Blush atlas kombinatsiya ko''ylak',
     'Атласное платье косого кроя на регулируемых бретелях с лёгким, почти невесомым финишем.',
     'Qiyshiq bichimli atlas ko''ylak — sozlanadigan bandchalar va yengil, deyarli vaznsiz pardoz.'),
    ('magenta-evening-gown',
     'Вечернее платье Magenta',
     'Magenta kechki ko''ylagi',
     'Вечернее платье в пол из яркого пурпурного крепа со скульптурным лифом.',
     'Yorqin siyohrang krepdan tikilgan, haykaltarosh kabi shakllangan ko''krak qismli uzun kechki ko''ylak.'),
    ('ivory-tea-dress',
     'Платье миди Ivory Tea',
     'Ivory choy ko''ylagi',
     'Платье миди из жатого хлопка с обтяжными пуговицами и широкой юбкой.',
     'G''ijimlangan paxtadan tikilgan midi ko''ylak — mato bilan qoplangan tugmalar va keng etak.'),
    ('rose-wool-coat',
     'Шерстяное пальто на запах Rose',
     'Rose jun o''ralma palto',
     'Двухслойное шерстяное пальто на запах с поясом и приспущенным плечом.',
     'Ikki qatlamli jundan o''ralma palto — bog''ichli kamar va tushirilgan yelka.'),
    ('blush-trench',
     'Хлопковый тренч Blush',
     'Blush paxta trenchi',
     'Лёгкий тренч из хлопковой саржи пудрового оттенка с ветрозащитным клапаном и роговыми пуговицами.',
     'Pudra rangdagi paxta sarjadan yengil trench — shamoldan himoya qopqog''i va shox tugmalar.'),
    ('quilted-rose-jacket',
     'Стёганая куртка Rose',
     'Rose steppelangan kurtkasi',
     'Укороченная стёганая куртка с атласной подкладкой и застёжкой на кнопках.',
     'Kalta steppelangan kurtka — atlas astar va tugmachali qadama.'),
    ('silk-rose-scarf',
     'Шёлковый платок Rose',
     'Rose ipak ro''moli',
     'Платок из шёлкового твила с подшитым вручную краем и фирменным шестилепестковым узором Yesmine.',
     'Ipak tvildan ro''mol — qo''lda o''ralgan chekka va Yesmine''ning olti bargli gul naqshi.'),
    ('petal-gold-earrings',
     'Золотые серьги Petal',
     'Petal oltin sirg''alari',
     'Серьги-подвески в форме шести лепестков из позолоченного серебра, почти невесомые.',
     'Oltin qoplamali kumushdan olti barg shaklidagi osma sirg''alar — patdek yengil.'),
    ('rose-leather-belt',
     'Кожаный ремень Rose',
     'Rose charm kamari',
     'Узкий ремень из итальянской кожи с матовой пряжкой в розовом тоне.',
     'Italyan charmidan ingichka kamar — pushti tusdagi mat toqa.'),
    ('pleated-blush-skirt',
     'Плиссированная юбка миди Blush',
     'Blush plisse midi yubkasi',
     'Юбка миди в солнечную плиссировку с эластичным атласным поясом.',
     'Quyosh nurlari kabi plisselangan midi yubka — cho''ziluvchan atlas belbog''.'),
    ('rose-knit-set',
     'Трикотажный комплект Rose',
     'Rose trikotaj to''plami',
     'Комплект из тонкого трикотажа: топ и брюки широкого кроя в тёплом розовом оттенке.',
     'Nozik trikotajdan to''plam: iliq pushti rangdagi yuqori qism va keng shim.')
  ) AS t(slug, name_ru, name_uz, description_ru, description_uz)
 WHERE p.slug = t.slug;

-- ---------------------------------------------------------------------------
-- 2. Media bucket for admin-uploaded photos
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media', 'media', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/avif','image/gif'];

DROP POLICY IF EXISTS "media public read" ON storage.objects;
DROP POLICY IF EXISTS "media admin insert" ON storage.objects;
DROP POLICY IF EXISTS "media admin update" ON storage.objects;
DROP POLICY IF EXISTS "media admin delete" ON storage.objects;

-- Shop photos are meant to be seen by everyone; only an admin can put them there.
CREATE POLICY "media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "media admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "media admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 3. Extra interface strings the new UI needs
-- ---------------------------------------------------------------------------
INSERT INTO public.translations (key, en, ru, uz) VALUES
  ('shop.loadMore','Load more','Показать ещё','Yana ko''rsatish'),
  ('shop.showing','Showing {shown} of {total}','Показано {shown} из {total}','{total} tadan {shown} tasi'),
  ('about.pillar1.title','Made in small runs','Малые партии','Kichik partiyalarda'),
  ('about.pillar1.body','Every style is cut in limited quantities so nothing is wasted and every seam is checked by hand.','Каждая модель шьётся ограниченным тиражом: ничего не пропадает, а каждый шов проверяется вручную.','Har bir model cheklangan miqdorda tikiladi — hech narsa isrof bo''lmaydi, har bir tik qo''lda tekshiriladi.'),
  ('about.pillar2.title','Natural fabrics','Натуральные ткани','Tabiiy matolar'),
  ('about.pillar2.body','Silk, wool, linen and cotton sourced from mills we visit in person, chosen for how they age.','Шёлк, шерсть, лён и хлопок с фабрик, которые мы посещаем лично, выбранные за то, как они стареют.','Ipak, jun, zig''ir va paxta — o''zimiz borib ko''rgan fabrikalardan, yillar o''tishi bilan qanday ko''rinishiga qarab tanlangan.'),
  ('about.pillar3.title','Designed to last','Создано надолго','Uzoq yillarga'),
  ('about.pillar3.body','Timeless silhouettes in a soft rose palette — pieces you''ll return to season after season.','Вневременные силуэты в мягкой розовой палитре — вещи, к которым возвращаешься сезон за сезоном.','Yumshoq pushti palitradagi zamon o''tmas siluetlar — mavsumdan mavsumga qaytadigan buyumlar.'),
  ('about.since','Since 2019','С 2019 года','2019 yildan beri'),
  ('about.cta','Wear something made with care','Носите то, что создано с заботой','Mehr bilan yaratilgan kiyimni kiying')
ON CONFLICT (key) DO NOTHING;
