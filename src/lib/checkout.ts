import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/lib/cart";

/**
 * Demo payment gateway.
 *
 * Nothing here talks to a real processor — but it behaves like one: the card is
 * validated the way an acquirer would (Luhn + expiry), the request takes a moment,
 * and a known set of test cards is declined so the failure path is reachable.
 */

const DECLINE_CODES: Record<string, string> = {
  "4000000000000002": "Your card was declined by the issuing bank.",
  "4000000000009995": "Insufficient funds on this card.",
  "4000000000009987": "This card has been reported lost or stolen.",
  "4100000000000019": "The payment was flagged as high risk and blocked.",
};

export const DEMO_SUCCESS_CARD = "4242 4242 4242 4242";
export const DEMO_DECLINE_CARD = "4000 0000 0000 0002";

/** Standard mod-10 checksum every real card number satisfies. */
export function passesLuhn(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Groups a raw card number into 4-digit blocks as the shopper types. */
export const formatCardNumber = (raw: string) =>
  raw
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();

/** Keeps the expiry field as MM/YY while typing, without fighting backspace. */
export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function expiryIsInThePast(expiry: string, now = new Date()): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const endOfMonth = new Date(year, month, 1);
  return endOfMonth <= now;
}

export type PaymentResult = { ok: true; last4: string } | { ok: false; message: string };

export async function processDemoPayment(
  card: { number: string; expiry: string },
  { delayMs = 1200 } = {},
): Promise<PaymentResult> {
  const number = card.number.replace(/\D/g, "");
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (!passesLuhn(number)) {
    return { ok: false, message: "That card number didn't pass verification. Check the digits." };
  }
  if (expiryIsInThePast(card.expiry)) {
    return { ok: false, message: "That card has expired." };
  }
  const declined = DECLINE_CODES[number];
  if (declined) {
    return { ok: false, message: declined };
  }
  return { ok: true, last4: number.slice(-4) };
}

/* ------------------------------------------------------------------ */
/* Order placement                                                     */
/* ------------------------------------------------------------------ */

export type PaymentMethod = "card" | "cod";

/**
 * Payme takes its parameters as one base64 blob on the checkout URL:
 * merchant, the account field it will echo back to us, the amount in tiyin,
 * and where to send the customer afterwards.
 */
export function paymeCheckoutUrl(input: {
  merchantId: string;
  orderNumber: string;
  totalSom: number;
  returnUrl: string;
}): string {
  const params = [
    `m=${input.merchantId}`,
    `ac.order_id=${input.orderNumber}`,
    `a=${Math.round(input.totalSom * 100)}`,
    `c=${input.returnUrl}`,
    "l=uz",
  ].join(";");
  return `https://checkout.paycom.uz/${btoa(params)}`;
}

export type PlacedOrder = {
  order_number: string;
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: string;
};

export type OrderDetails = {
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
};

/**
 * The browser never sends prices. `place_order` reads them from the products
 * table, moves stock and returns the authoritative total.
 */
export async function placeOrder(input: {
  details: OrderDetails;
  coords: { lat: number; lng: number };
  cardLast4: string;
  items: CartItem[];
  paymentMethod: PaymentMethod;
}): Promise<PlacedOrder> {
  const { data, error } = await supabase.rpc("place_order", {
    p_customer_name: input.details.customer_name.trim(),
    p_phone: input.details.phone.trim(),
    p_email: input.details.email.trim(),
    p_address: input.details.address.trim(),
    p_note: input.details.note.trim(),
    p_lat: input.coords.lat,
    p_lng: input.coords.lng,
    p_card_last4: input.cardLast4,
    p_payment_method: input.paymentMethod,
    p_items: input.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      size: i.size,
      color: i.color,
    })),
  });

  if (error) throw new Error(orderErrorMessage(error.message));
  const order = data as unknown as PlacedOrder | null;
  if (!order?.order_number) throw new Error("We couldn't place the order. Please try again.");
  return {
    order_number: order.order_number,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    total: Number(order.total),
    payment_method: order.payment_method ?? input.paymentMethod,
    payment_status: order.payment_status ?? "paid",
  };
}

/** Creates the order in a pending state; Payme marks it paid when money lands. */
export async function placeOrderViaPayme(input: {
  details: OrderDetails;
  coords: { lat: number; lng: number };
  items: CartItem[];
}): Promise<PlacedOrder> {
  const { data, error } = await supabase.rpc("place_order_payme", {
    p_customer_name: input.details.customer_name.trim(),
    p_phone: input.details.phone.trim(),
    p_email: input.details.email.trim(),
    p_address: input.details.address.trim(),
    p_note: input.details.note.trim(),
    p_lat: input.coords.lat,
    p_lng: input.coords.lng,
    p_items: input.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      size: i.size,
      color: i.color,
    })),
  });

  if (error) throw new Error(orderErrorMessage(error.message));
  const order = data as unknown as PlacedOrder | null;
  if (!order?.order_number) throw new Error("We couldn't place the order. Please try again.");
  return {
    order_number: order.order_number,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    total: Number(order.total),
    payment_method: "card",
    payment_status: "pending",
  };
}

/** Turns the database's sentinel errors into something a shopper can act on. */
export function orderErrorMessage(raw: string): string {
  if (raw.includes("place_order")) {
    // The migration that creates the function hasn't been applied to this project yet.
    return "Checkout isn't wired up on this database yet — run the latest migration.";
  }
  const outOfStock = /OUT_OF_STOCK:(.+?)(?:$|\n)/.exec(raw);
  if (outOfStock) return `"${outOfStock[1]?.trim()}" just sold out. Please adjust your cart.`;
  if (raw.includes("PRODUCT_UNAVAILABLE")) return "One of the pieces is no longer available.";
  if (raw.includes("INVALID_VARIANT")) return "That size or colour is no longer offered.";
  if (raw.includes("INVALID_QUANTITY")) return "Please order between 1 and 20 of each piece.";
  if (raw.includes("EMPTY_CART")) return "Your cart is empty.";
  if (raw.includes("TOO_MANY_ITEMS")) return "That's too many lines for one order.";
  if (raw.includes("TOO_MANY_ORDERS"))
    return "You've placed several orders in the last few minutes. Please wait a little, or call us.";
  if (raw.includes("INVALID_NAME")) return "Please enter your full name.";
  if (raw.includes("INVALID_PHONE")) return "Please enter a valid phone number.";
  if (raw.includes("INVALID_ADDRESS")) return "Please enter a delivery address.";
  if (raw.includes("PAYMENTS_NOT_LIVE")) return "Card payment isn't switched on yet.";
  return "We couldn't place the order. Please try again.";
}
