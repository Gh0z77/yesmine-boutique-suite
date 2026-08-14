// Kontent rejasidagi postni ijtimoiy tarmoqqa e'lon qiladi.
//
// Hozir Telegram to'liq ishlaydi — unga faqat bot tokeni kerak, boshqa hech
// qanday tasdiqlash talab qilinmaydi. Instagram va YouTube uchun Meta va
// Google tomonida ilova ochilishi kerak; ular sozlanmaguncha bu funksiya
// aniq sabab qaytaradi, jim qolmaydi.
//
// Sozlamalar (Supabase → Edge Functions → Secrets):
//   TELEGRAM_BOT_TOKEN   — @BotFather bergan token
// Kanal esa panelda "Ulangan tarmoqlar" ichida telegram sifatida turadi
// (handle = @kanal_nomi). Bot o'sha kanalda administrator bo'lishi shart.
//
// Deploy:  ./sb functions deploy smm-publish

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const authHeader = request.headers.get("Authorization") ?? "";
    const asCaller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Only someone whose job includes publishing may push anything outward.
    const { data: allowed, error: permError } = await asCaller.rpc("has_permission", {
      p_code: "social.publish",
    });
    if (permError || allowed !== true) {
      return json({ error: "Sizda e'lon qilish huquqi yo'q." }, 403);
    }

    const { plan_id } = (await request.json()) as { plan_id?: string };
    if (!plan_id) return json({ error: "Post tanlanmagan." }, 400);

    const { data: plan, error: planError } = await asCaller
      .from("content_plan")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) return json({ error: "Post topilmadi." }, 404);
    if (plan.status === "published") return json({ error: "Bu post allaqachon e'lon qilingan." }, 400);

    const caption = [plan.caption, plan.hashtags].filter(Boolean).join("\n\n").trim();

    if (plan.platform !== "telegram") {
      return json({
        error:
          `${plan.platform} uchun ulanish hali sozlanmagan. Meta yoki Google ` +
          `tomonida ilova ochilib, kalitlari qo'yilgach ishlaydi. Hozircha ` +
          `qo'lda joylang va havolasini yozib qo'ying.`,
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: settings } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "social")
      .maybeSingle();
    const config = (settings?.value ?? {}) as Record<string, string>;

    const token = config["telegram_bot_token"]?.trim() || Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) {
      return json({
        error:
          "Telegram bot tokeni qo'yilmagan. Admin panel → Sozlamalar → Ijtimoiy tarmoqlar bo'limiga tokenni kiriting.",
      });
    }

    let channelHandle = config["telegram_channel"]?.trim() ?? "";
    if (!channelHandle) {
      const { data: channel } = await asCaller
        .from("smm_accounts")
        .select("handle")
        .eq("platform", "telegram")
        .limit(1)
        .maybeSingle();
      channelHandle = channel?.handle ?? "";
    }

    if (!channelHandle) {
      return json({
        error:
          "Telegram kanali kiritilmagan. Admin panel → Sozlamalar → Ijtimoiy tarmoqlar bo'limiga @kanal_nomi ni yozing.",
      });
    }

    // The first picture or clip attached to the post travels with the text.
    const { data: assets } = await asCaller
      .from("content_assets")
      .select("kind, path")
      .eq("plan_id", plan_id)
      .order("created_at")
      .limit(1);

    const asset = assets?.[0];
    const base = `https://api.telegram.org/bot${token}`;
    const publicUrl = asset
      ? `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/media/${asset.path}`
      : null;

    let endpoint = `${base}/sendMessage`;
    let payload: Record<string, unknown> = {
      chat_id: channelHandle,
      text: caption || plan.title,
    };

    if (publicUrl && asset) {
      const video = asset.kind === "video";
      endpoint = `${base}/${video ? "sendVideo" : "sendPhoto"}`;
      payload = {
        chat_id: channelHandle,
        [video ? "video" : "photo"]: publicUrl,
        caption: (caption || plan.title).slice(0, 1024),
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.ok) {
      return json({ error: `Telegram rad etdi: ${result.description ?? "noma'lum sabab"}` });
    }

    const messageId = result.result?.message_id;
    const handle = channelHandle.replace(/^@/, "");
    const link = messageId ? `https://t.me/${handle}/${messageId}` : null;

    await asCaller
      .from("content_plan")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        external_url: link,
      })
      .eq("id", plan_id);

    return json({ ok: true, url: link });
  } catch (err) {
    return json({ error: `Xatolik: ${(err as Error).message}` });
  }
});
