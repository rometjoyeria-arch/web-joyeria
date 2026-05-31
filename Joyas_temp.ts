import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES: Record<string, string> = {
  anillo:     "ring (circular band worn on the finger)",
  colgante:   "pendant (hanging from a necklace chain)",
  pendientes: "earrings (a pair)",
  pulsera:    "bracelet (for the wrist)",
  gemelos:    "cufflinks (shirt cuff fasteners)",
  medallas:   "medallion (flat circular disc on a necklace chain)",
};

const CATEGORY_LABELS: Record<string, string> = {
  anillo: "Anillo", colgante: "Colgante", pendientes: "Pendientes",
  pulsera: "Pulsera", gemelos: "Gemelos", medallas: "Medalla",
};

const MATERIALS: Record<string, string> = {
  oro_amarillo: "18k yellow gold, warm mirror-polished",
  oro_blanco:   "18k white gold, rhodium-plated",
  oro_rosa:     "18k rose gold, pink-copper polished",
  platino:      "platinum 950, naturally white",
  plata:        "sterling silver 925, bright white polished",
};

const MATERIAL_LABELS: Record<string, string> = {
  oro_amarillo: "Oro Amarillo 18k", oro_blanco: "Oro Blanco 18k",
  oro_rosa: "Oro Rosa 18k", platino: "Platino 950", plata: "Plata 925",
};

const GEMINI_MODEL = "gemini-3.1-flash-image";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const NO_TEXT_RULE = `
STRICT RULES (no exceptions):
- Do NOT add any text, letters, initials, words, inscriptions, logos, brand marks, serial numbers, or watermarks ANYWHERE on the jewelry — not on the surface, not on the edge, not engraved, not stamped, not printed.
- Do NOT add hallmark stamps, maker's marks, or any alphanumeric characters of any kind.
- The piece must be completely free of any lettering or writing.
- The only decoration permitted is what is explicitly described in this prompt.
- White studio background. Photorealistic commercial jewelry photography quality.`;

async function generateView(
  prompt: string,
  imagePart: any | null,
  apiKey: string
): Promise<string | null> {
  const parts: any[] = [];
  if (imagePart) parts.push(imagePart);
  parts.push({ text: prompt });

  try {
    const res = await fetch(GEMINI_URL(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { 
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 0.4,
            maxOutputTokens: 2048
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Gemini error:", JSON.stringify(data).substring(0, 500));
      return null;
    }

    const responseParts = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
    return imgPart ? imgPart.inlineData.data : null;
  } catch (e) {
    console.error("Gemini exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_KEY")!;
  const apiKey = Deno.env.get("GEMINI_API_KEY")!;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const userToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!userToken) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers: corsHeaders });

  const { data: { user } } = await supabaseAdmin.auth.getUser(userToken);
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const credits = user.user_metadata?.credits ?? 0;
  if (credits <= 0) return new Response(JSON.stringify({ error: "No credits" }), { status: 402, headers: corsHeaders });

  const body = await req.json();
  const { nombre, email, categoria_producto, material, sugerencias, imagen_subida_url, gema_principal } = body;

  const isRedesign = sugerencias?.includes("Cambios solicitados:") || body.is_redesign === true;
  const userNotes = isRedesign
    ? (sugerencias?.split("Cambios solicitados:")?.[1]?.trim() || sugerencias || "")
    : (sugerencias || "").trim();

  const cat = CATEGORIES[categoria_producto] || categoria_producto || "medallion";
  const mat = MATERIALS[material] || material || "18k yellow gold";

  let imagePart: any | null = null;
  if (imagen_subida_url) {
    const imgRes = await fetch(imagen_subida_url);
    if (imgRes.ok) {
      const buf = await imgRes.arrayBuffer();
      imagePart = { inlineData: { mimeType: "image/jpeg", data: encode(new Uint8Array(buf)) } };
    }
  }

  let baseContext: string;
  if (isRedesign && imagePart) {
    baseContext = `Redesign this ${cat} in ${mat}. Changes: ${userNotes}. Original attached. ${NO_TEXT_RULE}`;
  } else if (imagePart) {
    baseContext = `Jewelry render of a ${cat} in ${mat} with this image as engraving. ${userNotes}. ${NO_TEXT_RULE}`;
  } else {
    baseContext = `Fine jewelry render of a ${cat} in ${mat}. ${gema_principal ? `Gem: ${gema_principal}.` : ""} ${userNotes}. ${NO_TEXT_RULE}`;
  }

  // Generate 3 views
  const [frontB64, backB64, sideB64] = await Promise.all([
    generateView(`${baseContext}\nFront View.`, imagePart, apiKey),
    generateView(`${baseContext}\nBack View.`, imagePart, apiKey),
    generateView(`${baseContext}\nSide View.`, imagePart, apiKey),
  ]);

  if (!frontB64) return new Response(JSON.stringify({ error: "Generation failed" }), { status: 500, headers: corsHeaders });

  async function saveImage(b64: string | null, label: string): Promise<string | null> {
    if (!b64) return null;
    const fname = `diseno_${Date.now()}_${label}.png`;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    await supabaseAdmin.storage.from("disenos").upload(fname, bytes, { contentType: "image/png" });
    return supabaseAdmin.storage.from("disenos").getPublicUrl(fname).data.publicUrl;
  }

  const [imagenFrontal, imagenTrasera, imagenLateral] = await Promise.all([
    saveImage(frontB64, "front"),
    saveImage(backB64, "back"),
    saveImage(sideB64, "side"),
  ]);

  const imagenUrl = imagenFrontal;

  const { data: insertedData, error: dbError } = await supabaseAdmin
    .from("solicitudes_disenos_romet")
    .insert({ ...body, imagen_generada_url: imagenUrl, prompt_usado: baseContext })
    .select().single();

  return new Response(
    JSON.stringify({ success: true, imagenUrl, imagenFrontal, imagenTrasera, imagenLateral, dbError }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
