-- Staff can now reach the data their job needs.
--
-- Every table was admin-only, which made the new cabinets decorative: a cashier
-- with 'orders.read' still saw an empty list. The policies below defer to
-- has_permission(), so access follows the position, and revoking a permission
-- in Admin -> Xodimlar takes effect immediately with no deploy.

DROP POLICY IF EXISTS "orders staff read" ON public.orders;
CREATE POLICY "orders staff read" ON public.orders FOR SELECT TO authenticated
  USING (public.has_permission('orders.read'));

DROP POLICY IF EXISTS "orders staff update" ON public.orders;
CREATE POLICY "orders staff update" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_permission('orders.update'))
  WITH CHECK (public.has_permission('orders.update'));

DROP POLICY IF EXISTS "order items staff read" ON public.order_items;
CREATE POLICY "order items staff read" ON public.order_items FOR SELECT TO authenticated
  USING (public.has_permission('orders.read'));

-- Stock edits belong to merchandisers and the supply desk.
DROP POLICY IF EXISTS "variants staff write" ON public.product_variants;
CREATE POLICY "variants staff write" ON public.product_variants FOR UPDATE TO authenticated
  USING (public.has_permission('stock.write'))
  WITH CHECK (public.has_permission('stock.write'));

DROP POLICY IF EXISTS "products staff write" ON public.products;
CREATE POLICY "products staff write" ON public.products FOR UPDATE TO authenticated
  USING (public.has_permission('products.write'))
  WITH CHECK (public.has_permission('products.write'));

-- The sales desk: ROP and operators work leads without being admins.
DROP POLICY IF EXISTS "leads staff read" ON public.leads;
CREATE POLICY "leads staff read" ON public.leads FOR SELECT TO authenticated
  USING (public.has_permission('leads.read'));

DROP POLICY IF EXISTS "leads staff write" ON public.leads;
CREATE POLICY "leads staff write" ON public.leads FOR ALL TO authenticated
  USING (public.has_permission('leads.write'))
  WITH CHECK (public.has_permission('leads.write'));

DROP POLICY IF EXISTS "lead events staff" ON public.lead_events;
CREATE POLICY "lead events staff" ON public.lead_events FOR ALL TO authenticated
  USING (public.has_permission('leads.write'))
  WITH CHECK (public.has_permission('leads.write'));

DROP POLICY IF EXISTS "operators staff read" ON public.sales_operators;
CREATE POLICY "operators staff read" ON public.sales_operators FOR SELECT TO authenticated
  USING (public.has_permission('leads.read'));

DROP POLICY IF EXISTS "sources staff read" ON public.lead_sources;
CREATE POLICY "sources staff read" ON public.lead_sources FOR SELECT TO authenticated
  USING (public.has_permission('leads.read'));
