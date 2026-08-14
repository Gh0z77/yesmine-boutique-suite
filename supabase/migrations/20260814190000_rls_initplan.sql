-- RLS qoidalarini tezlashtirish.
--
-- has_permission() qoida ichida to'g'ridan-to'g'ri chaqirilganda PostgreSQL
-- uni har bir qator uchun qaytadan bajaradi. Kichik jadvalda bu sezilmaydi,
-- lekin buyurtmalar o'sgach panel ochilmay qoladi: o'lchov ko'rsatdiki
-- 200 000 qatorda bitta so'rov 17,5 soniya ketadi.
--
-- (select ...) ichiga o'ralganda Postgres uni InitPlan sifatida bir marta
-- hisoblaydi. Kim nimani ko'rishi ZARRACHA o'zgarmaydi — faqat tezlik.

DROP POLICY IF EXISTS "ad_campaigns_read" ON public."ad_campaigns";
CREATE POLICY "ad_campaigns_read" ON public."ad_campaigns"
  FOR SELECT TO authenticated
  USING ((select has_permission('smm.read'::text)));

DROP POLICY IF EXISTS "ad_campaigns_write" ON public."ad_campaigns";
CREATE POLICY "ad_campaigns_write" ON public."ad_campaigns"
  FOR ALL TO authenticated
  USING ((select has_permission('ads.manage'::text)))
  WITH CHECK ((select has_permission('ads.manage'::text)));

DROP POLICY IF EXISTS "ai_requests_read" ON public."ai_requests";
CREATE POLICY "ai_requests_read" ON public."ai_requests"
  FOR SELECT TO authenticated
  USING ((select has_permission('smm.read'::text)));

DROP POLICY IF EXISTS "ai_requests_write" ON public."ai_requests";
CREATE POLICY "ai_requests_write" ON public."ai_requests"
  FOR INSERT TO authenticated
  WITH CHECK ((select has_permission('ai.use'::text)));

DROP POLICY IF EXISTS "cash_movements read" ON public."cash_movements";
CREATE POLICY "cash_movements read" ON public."cash_movements"
  FOR SELECT TO authenticated
  USING ((select has_permission('cash.register'::text)));

DROP POLICY IF EXISTS "cash_movements write" ON public."cash_movements";
CREATE POLICY "cash_movements write" ON public."cash_movements"
  FOR ALL TO authenticated
  USING ((select has_permission('cash.register'::text)))
  WITH CHECK ((select has_permission('cash.register'::text)));

DROP POLICY IF EXISTS "cash_sessions read" ON public."cash_sessions";
CREATE POLICY "cash_sessions read" ON public."cash_sessions"
  FOR SELECT TO authenticated
  USING ((select has_permission('cash.register'::text)));

DROP POLICY IF EXISTS "cash_sessions write" ON public."cash_sessions";
CREATE POLICY "cash_sessions write" ON public."cash_sessions"
  FOR ALL TO authenticated
  USING ((select has_permission('cash.register'::text)))
  WITH CHECK ((select has_permission('cash.register'::text)));

DROP POLICY IF EXISTS "content_assets_read" ON public."content_assets";
CREATE POLICY "content_assets_read" ON public."content_assets"
  FOR SELECT TO authenticated
  USING ((select has_permission('smm.read'::text)));

DROP POLICY IF EXISTS "content_assets_write" ON public."content_assets";
CREATE POLICY "content_assets_write" ON public."content_assets"
  FOR ALL TO authenticated
  USING ((select has_permission('media.upload'::text)))
  WITH CHECK ((select has_permission('media.upload'::text)));

DROP POLICY IF EXISTS "content_plan_read" ON public."content_plan";
CREATE POLICY "content_plan_read" ON public."content_plan"
  FOR SELECT TO authenticated
  USING ((select has_permission('smm.read'::text)));

DROP POLICY IF EXISTS "content_plan_write" ON public."content_plan";
CREATE POLICY "content_plan_write" ON public."content_plan"
  FOR ALL TO authenticated
  USING ((select has_permission('smm.write'::text)))
  WITH CHECK ((select has_permission('smm.write'::text)));

DROP POLICY IF EXISTS "employees hr read" ON public."employees";
CREATE POLICY "employees hr read" ON public."employees"
  FOR SELECT TO authenticated
  USING ((select has_permission('staff.read'::text)));

DROP POLICY IF EXISTS "employees hr update" ON public."employees";
CREATE POLICY "employees hr update" ON public."employees"
  FOR UPDATE TO authenticated
  USING ((select has_permission('staff.manage'::text)))
  WITH CHECK ((select has_permission('staff.manage'::text)));

DROP POLICY IF EXISTS "employees hr write" ON public."employees";
CREATE POLICY "employees hr write" ON public."employees"
  FOR INSERT TO authenticated
  WITH CHECK ((select has_permission('staff.manage'::text)));

DROP POLICY IF EXISTS "employees self read" ON public."employees";
CREATE POLICY "employees self read" ON public."employees"
  FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (select has_permission('staff.read'::text))));

DROP POLICY IF EXISTS "finance_entries read" ON public."finance_entries";
CREATE POLICY "finance_entries read" ON public."finance_entries"
  FOR SELECT TO authenticated
  USING ((select has_permission('finance.read'::text)));

DROP POLICY IF EXISTS "finance_entries write" ON public."finance_entries";
CREATE POLICY "finance_entries write" ON public."finance_entries"
  FOR ALL TO authenticated
  USING ((select has_permission('finance.write'::text)))
  WITH CHECK ((select has_permission('finance.write'::text)));

DROP POLICY IF EXISTS "lead events staff" ON public."lead_events";
CREATE POLICY "lead events staff" ON public."lead_events"
  FOR ALL TO authenticated
  USING ((select has_permission('leads.write'::text)))
  WITH CHECK ((select has_permission('leads.write'::text)));

DROP POLICY IF EXISTS "sources staff read" ON public."lead_sources";
CREATE POLICY "sources staff read" ON public."lead_sources"
  FOR SELECT TO authenticated
  USING ((select has_permission('leads.read'::text)));

DROP POLICY IF EXISTS "leads staff read" ON public."leads";
CREATE POLICY "leads staff read" ON public."leads"
  FOR SELECT TO authenticated
  USING ((select has_permission('leads.read'::text)));

DROP POLICY IF EXISTS "leads staff write" ON public."leads";
CREATE POLICY "leads staff write" ON public."leads"
  FOR ALL TO authenticated
  USING ((select has_permission('leads.write'::text)))
  WITH CHECK ((select has_permission('leads.write'::text)));

DROP POLICY IF EXISTS "order items staff read" ON public."order_items";
CREATE POLICY "order items staff read" ON public."order_items"
  FOR SELECT TO authenticated
  USING ((select has_permission('orders.read'::text)));

DROP POLICY IF EXISTS "orders staff read" ON public."orders";
CREATE POLICY "orders staff read" ON public."orders"
  FOR SELECT TO authenticated
  USING ((select has_permission('orders.read'::text)));

DROP POLICY IF EXISTS "orders staff update" ON public."orders";
CREATE POLICY "orders staff update" ON public."orders"
  FOR UPDATE TO authenticated
  USING ((select has_permission('orders.update'::text)))
  WITH CHECK ((select has_permission('orders.update'::text)));

DROP POLICY IF EXISTS "variants staff write" ON public."product_variants";
CREATE POLICY "variants staff write" ON public."product_variants"
  FOR UPDATE TO authenticated
  USING ((select has_permission('stock.write'::text)))
  WITH CHECK ((select has_permission('stock.write'::text)));

DROP POLICY IF EXISTS "products staff write" ON public."products";
CREATE POLICY "products staff write" ON public."products"
  FOR UPDATE TO authenticated
  USING ((select has_permission('products.write'::text)))
  WITH CHECK ((select has_permission('products.write'::text)));

DROP POLICY IF EXISTS "operators staff read" ON public."sales_operators";
CREATE POLICY "operators staff read" ON public."sales_operators"
  FOR SELECT TO authenticated
  USING ((select has_permission('leads.read'::text)));

DROP POLICY IF EXISTS "shifts read" ON public."shifts";
CREATE POLICY "shifts read" ON public."shifts"
  FOR SELECT TO authenticated
  USING ((select has_permission('shift.read'::text)));

DROP POLICY IF EXISTS "shifts write" ON public."shifts";
CREATE POLICY "shifts write" ON public."shifts"
  FOR ALL TO authenticated
  USING ((select has_permission('shift.manage'::text)))
  WITH CHECK ((select has_permission('shift.manage'::text)));

DROP POLICY IF EXISTS "smm_accounts_read" ON public."smm_accounts";
CREATE POLICY "smm_accounts_read" ON public."smm_accounts"
  FOR SELECT TO authenticated
  USING ((select has_permission('smm.read'::text)));

DROP POLICY IF EXISTS "smm_accounts_write" ON public."smm_accounts";
CREATE POLICY "smm_accounts_write" ON public."smm_accounts"
  FOR ALL TO authenticated
  USING ((select has_permission('social.publish'::text)))
  WITH CHECK ((select has_permission('social.publish'::text)));

DROP POLICY IF EXISTS "supply_items read" ON public."supply_items";
CREATE POLICY "supply_items read" ON public."supply_items"
  FOR SELECT TO authenticated
  USING ((select has_permission('products.read'::text)));

DROP POLICY IF EXISTS "supply_items write" ON public."supply_items";
CREATE POLICY "supply_items write" ON public."supply_items"
  FOR ALL TO authenticated
  USING ((select has_permission('supply.manage'::text)))
  WITH CHECK ((select has_permission('supply.manage'::text)));

DROP POLICY IF EXISTS "supply_orders read" ON public."supply_orders";
CREATE POLICY "supply_orders read" ON public."supply_orders"
  FOR SELECT TO authenticated
  USING ((select has_permission('products.read'::text)));

DROP POLICY IF EXISTS "supply_orders write" ON public."supply_orders";
CREATE POLICY "supply_orders write" ON public."supply_orders"
  FOR ALL TO authenticated
  USING ((select has_permission('supply.manage'::text)))
  WITH CHECK ((select has_permission('supply.manage'::text)));
