# Yesmine Fashion Hub

YESMINE — Lovable.dev uchun BITTA to'liq (mega) prompt

Buni to'liq nusxalab, Lovable.dev'ga bitta xabar sifatida yuboring.

Build a complete, premium, production-quality fashion e-commerce web application called "Yesmine" — a women's clothing brand. Build as much of the full system below as possible in this single build: design system, landing page, shop/marketplace, cart, checkout with demo payment and delivery location, and a full admin panel connected to a real database. Treat this as one complete project, not a prototype — implement real, working logic everywhere (real database-backed products/orders, not static mock arrays), not just visuals.

1. Brand & Design System

Brand name: Yesmine. Logo concept: elegant cursive white script wordmark "Yesmine", paired with a circular emblem — a white feminine silhouette profile (with flowing hair/hijab line) inside a crescent-like circle, next to a white six-petal flower line-art icon.

Color palette (from the actual logo — use these exact tones as CSS variables):

--rose-deep: #C4145A

--pink-vivid: #F0568F

--pink-blush: #F9A8C9

--magenta-bg: #E23570

--white: #FFFFFF

--ink: #1A1A1A (body text on light backgrounds)

Backgrounds: soft blurred rose/magenta/pink gradient blobs (mesh-gradient style, matching the logo background) used behind hero sections and key panels.

Typography: elegant serif/display font for headings (Playfair Display or Cormorant Garamond), clean modern sans (Inter or Poppins) for body/UI text, script font reserved for the logo wordmark only.

Visual language: glassmorphism cards, generous white space, soft shadows, rounded-elegant corners, smooth scroll-reveal animations (fade/slide-up on scroll), subtle floating 3D tilt on product cards on hover, a light CSS 3D / parallax hero effect (petals or fabric drifting, or a subtle 3D-rotating product mockup) — premium and restrained, never gimmicky or laggy. Fully responsive for mobile/tablet/desktop with polished micro-interactions on every button, card, and input.

2. Global Structure

Header (sticky, glassmorphic on scroll): Yesmine logo, nav links (Home, Shop, About, Contact), language switcher (EN / RU / UZ), cart icon with live item count, on Shop pages a search bar. Footer: brand blurb, quick links, categories, contact info, social icons, newsletter signup, language switcher, copyright.

3. Landing Page (/)

Hero: full-bleed animated rose/pink gradient background, logo emblem animated entrance, headline + subheadline (elegant fashion brand messaging), primary CTA "Shop Now" → /shop.

Brand story / About section with an image + text split layout.

Featured collections: 3–4 category cards (e.g. Dresses, Outerwear, Accessories, New Arrivals) with hover 3D tilt, linking into the shop filtered by category.

New Arrivals / Best Sellers: a live product carousel pulling real products from the database (not hardcoded).

Testimonials / customer reviews carousel.

Lookbook / Instagram-style image gallery grid.

Newsletter signup form.

Footer as above.

4. Shop Page (/shop) — real functioning marketplace, Uzum Market–style

Sidebar/top filters: category, size, color, price range; sort by price/newest/popularity.

Responsive product grid with image, name, price, quick "Add to Cart".

Product detail page (/shop/:productId): image gallery, name, price, description, size selector, color selector, quantity stepper, "Add to Cart", stock status, related products section.

Cart: slide-out drawer AND a dedicated /cart page — line items with thumbnail, name, selected size/color, quantity editor, remove button, subtotal, "Proceed to Checkout".

Checkout (/checkout), multi-step:

Customer info: full name, phone, email.

Delivery: address text field plus an interactive map with a draggable pin to select the exact delivery location (store latitude/longitude with the order).

Payment (demo): realistic card-style payment form (card number, expiry, CVV, name) that simulates processing and returns success/failure — clearly a sandbox/demo flow in code, but visually and UX-wise indistinguishable from a real premium checkout.

Confirmation: order summary, generated order number, "what happens next" messaging.

All of the above must read/write to a real backend (see section 6) so orders placed here actually appear in the admin panel, and products shown here are the ones the admin actually added.

5. Admin Panel (/admin, login-protected)

Login screen (email/password auth).

Dashboard: total revenue, total orders, order-status breakdown, top-selling products, recent orders list.

Products: table view with search/filter; create/edit/delete product form (name, description, price, stock, category, sizes[], colors[], multiple images, active/inactive toggle).

Categories: create/edit/delete.

Orders: full list with filters by status/date; order detail view showing customer info, ordered items, delivery address + map location, payment status, current order status, with a control to update order status (pending → processing → shipped → delivered → cancelled).

Landing Page Content: editable fields for hero headline/subheadline, featured collections, testimonials, gallery images — changes reflect live on the landing page.

Translations: a simple table/editor to manage the EN/RU/UZ text strings used across the site.

Clean, distinct admin visual style (sidebar nav + data tables + forms), still on-brand but simpler/functional than the customer-facing site.

6. Backend / Data

Use a real connected database (e.g. Supabase) with tables for: products, categories, orders, order_items, translations/content (for landing page + i18n strings), and admin users/auth.

Cart state can be client-side (persisted in local state/session), but checkout must write a real order row (with items, customer info, delivery location, payment status) to the database.

Admin auth must actually gate /admin routes.

7. Internationalization

Full site (landing, shop, checkout, and all UI chrome) must support English, Russian, and Uzbek via a language switcher, with strings sourced so they can be edited later from the admin Translations section.

8. Quality Bar

This must look and function like a real, premium, production-ready fashion e-commerce brand — visually cohesive with the Yesmine rose/pink logo identity, with genuinely working shop → cart → checkout → order-in-admin logic end to end, fast and smooth on mobile, and a fully usable admin panel a non-technical store owner could run the business from.

Build everything you can from this single prompt, prioritizing: (1) design system + landing page, (2) shop + product detail + cart, (3) checkout with demo payment + location, (4) admin panel with product/order CRUD, (5) i18n, (6) database wiring — in that order, so the most foundational/visible pieces are solid even if something further down needs finishing later.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5a78b889-3077-4221-994c-2447a2b22df0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
