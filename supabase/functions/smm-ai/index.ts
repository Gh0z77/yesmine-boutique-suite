// AI yordamchi — matn, ssenariy, tahlil va rasm.
//
// Kalit shu yerda qoladi. Brauzer hech qachon kalitni ko'rmaydi: panel shu
// funksiyaga so'rov yuboradi, funksiya modelga boradi va faqat natijani
// qaytaradi. Kalit o'g'irlansa, uni ishlatgan odam butun hisobni sarflaydi —
// shuning uchun u faqat serverda turadi.
//
// Kerakli sozlama (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY   — https://aistudio.google.com/apikey dan olinadi
//
// Deploy:  ./sb functions deploy smm-ai

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEXT_MODEL = "gemini-2.0-flash";
const IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation";

type Kind = "caption" | "scenario" | "analysis" | "image" | "hashtags" | "idea";

/** Yesmine's voice, given to the model once so every answer sounds the same. */
const BRAND = `Sen Yesmine uchun ishlaysan — O'zbekistondagi ayollar kiyimi
brendi. Uslub: nafis, iliq, ortiqcha shovqinsiz. Narxni bo'rttirma, va'da berma.
Javobni faqat o'zbek tilida yoz. Emoji kam ishlat.`;

const INSTRUCTIONS: Record<Kind, string> = {
  idea: `${BRAND}\nQuyidagi mavzu bo'yicha 5 ta kontent g'oyasi ber. Har biri:
sarlavha, format (reels/post/story), qisqa izoh — 1 qatordan.`,

  scenario: `${BRAND}\nQuyidagi mavzuga Reels ssenariysi yoz. 20-40 soniya.
Kadrma-kadr yoz: [0-3s] ... [3-8s] ... Har kadrda nima ko'rinadi va nima
aytiladi. Oxirida qisqa harakatga chaqiruv.`,

  caption: `${BRAND}\nQuyidagi mavzuga Instagram uchun post matni yoz.
2-4 jumla. Birinchi jumla e'tiborni tutsin. Oxirida savol yoki chaqiruv.`,

  hashtags: `${BRAND}\nQuyidagi mavzuga 15 ta hashtag ber. O'zbek va rus
auditoriyasi uchun aralash. Faqat hashtaglar, boshqa matn yozma.`,

  analysis: `${BRAND}\nQuyidagi ma'lumotni tahlil qil. Nima yaxshi ishlagan,
nima ishlamagan, keyingi hafta nima qilish kerak — 3 ta aniq tavsiya bilan
yakunla. Qisqa va aniq yoz.`,

  image: "",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    // The owner types the key into the admin panel; an environment secret
    // still works as a fallback for deployments that prefer it.
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

    const apiKey = config["gemini_api_key"]?.trim() || Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json(
        {
          error:
            "AI kaliti qo'yilmagan. Admin panel → Sozlamalar → Ijtimoiy tarmoqlar bo'limiga Gemini kalitini kiriting.",
        },
        200,
      );
    }

    // The caller must be a signed-in employee; the panel forwards their token.
    const authHeader = request.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: allowed, error: permError } = await supabase.rpc("has_permission", {
      p_code: "ai.use",
    });
    if (permError || allowed !== true) {
      return json({ error: "Sizda AI ishlatish huquqi yo'q." }, 403);
    }

    const body = (await request.json()) as {
      kind?: Kind;
      prompt?: string;
      plan_id?: string | null;
      employee_id?: string | null;
    };

    const kind = (body.kind ?? "idea") as Kind;
    const prompt = (body.prompt ?? "").trim();

    if (!prompt) return json({ error: "So'rov bo'sh." }, 400);
    if (prompt.length > 4000) return json({ error: "So'rov juda uzun." }, 400);
    if (!(kind in INSTRUCTIONS)) return json({ error: "Noma'lum turi." }, 400);

    const model = kind === "image" ? IMAGE_MODEL : TEXT_MODEL;
    const fullPrompt =
      kind === "image"
        ? `${prompt}. Studiya sifatida, yuqori aniqlikda, tabiiy yorug'lik.`
        : `${INSTRUCTIONS[kind]}\n\n---\n${prompt}`;

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig:
            kind === "image"
              ? { responseModalities: ["TEXT", "IMAGE"] }
              : { temperature: 0.9, maxOutputTokens: 2048 },
        }),
      },
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      await log(supabase, kind, prompt, null, null, body, "failed", detail.slice(0, 400));
      return json({ error: `Model javob bermadi (${upstream.status}).` }, 200);
    }

    const payload = await upstream.json();
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];

    let text = "";
    let imageUrl = "";
    for (const part of parts) {
      if (part.text) text += part.text;
      if (part.inlineData?.data) {
        imageUrl = `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
      }
    }

    await log(supabase, kind, prompt, text, model, body, "done", null);

    return json({ text: text.trim(), image_url: imageUrl });
  } catch (err) {
    return json({ error: `Xatolik: ${(err as Error).message}` }, 200);
  }
});

/** Every answer is written down: who asked, what came back, which model. */
async function log(
  supabase: ReturnType<typeof createClient>,
  kind: string,
  prompt: string,
  output: string | null,
  model: string | null,
  body: { plan_id?: string | null; employee_id?: string | null },
  status: string,
  error: string | null,
) {
  await supabase.from("ai_requests").insert({
    kind,
    prompt,
    output,
    model,
    status,
    error,
    plan_id: body.plan_id ?? null,
    requested_by: body.employee_id ?? null,
  });
}
