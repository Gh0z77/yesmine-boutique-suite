-- The scrolling brand strip on the landing page.
INSERT INTO public.translations (key, en, ru, uz) VALUES
  ('marquee.silk','Silk','Шёлк','Ipak'),
  ('marquee.handFinished','Hand-finished','Ручная отделка','Qo''lda pardozlangan'),
  ('marquee.smallRuns','Small runs','Малые партии','Kichik partiyalar'),
  ('marquee.roseTones','Rose tones','Розовые оттенки','Pushti ranglar'),
  ('marquee.madeByWomen','Made by women','Создано женщинами','Ayollar tomonidan')
ON CONFLICT (key) DO NOTHING;
