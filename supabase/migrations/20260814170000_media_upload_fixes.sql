-- Rasm va video yuklashdagi to'siqlarni olib tashlash.
--
-- Uchta muammo bor edi:
--   1. Hajm chegarasi 5 MB — zamonaviy telefon surati ko'pincha shundan katta,
--      shuning uchun yuklash sababsizdek ko'rinib rad etilardi.
--   2. Faqat rasm formatlari ruxsat etilgan edi, lekin mobilograf paneli
--      video yuklashni taklif qiladi — video har safar rad etilardi.
--   3. Storage'ga faqat admin yoza olardi, holbuki media.upload huquqi
--      berilgan xodim ham yuklashi kerak.

UPDATE storage.buckets
   SET file_size_limit = 52428800,          -- 50 MB
       allowed_mime_types = ARRAY[
         'image/jpeg','image/png','image/webp','image/avif','image/gif',
         'image/heic','image/heif',          -- iPhone suratlari
         'video/mp4','video/quicktime','video/webm'
       ]
 WHERE id = 'media';

-- media.upload huquqi bo'lgan xodim ham yuklay olsin.
DROP POLICY IF EXISTS "media staff insert" ON storage.objects;
CREATE POLICY "media staff insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_permission('media.upload'));

-- O'zi yuklaganini almashtira olsin; o'chirish admin ixtiyorida qoladi.
DROP POLICY IF EXISTS "media staff update" ON storage.objects;
CREATE POLICY "media staff update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.has_permission('media.upload'))
  WITH CHECK (bucket_id = 'media' AND public.has_permission('media.upload'));
