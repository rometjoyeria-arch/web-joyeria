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

const MATERIALS: Record<string, string> = {
  oro_amarillo: "18k yellow gold, warm mirror-polished",
  oro_blanco:   "18k white gold, rhodium-plated",
  oro_rosa:     "18k rose gold, pink-copper polished",
  platino:      "platinum 950, naturally white",
  plata:        "sterling silver 925, bright white polished",
};

// gemini-2.5-flash-image supports multimodal input AND image output via generateContent
const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

async function generateView(
  prompt: string,
  imagePart: unknown | null,
  apiKey: string
): Promise<string | null> {
  const parts: unknown[] = [];
  if (imagePart) parts.push(imagePart);
  parts.push({ text: prompt });

  try {
    const res = await fetch(GEMINI_URL(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Gemini error:", JSON.stringify(data).substring(0, 500));
      return null;
    }

    const responseParts = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imgPart) {
      console.error("No image in response. finishReason:", data?.candidates?.[0]?.finishReason);
      console.error("Response snippet:", JSON.stringify(data).substring(0, 600));
      return null;
    }

    return imgPart.inlineData.data; // base64
  } catch (e) {
    console.error("Gemini fetch exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(Deno.env.get("URL")!, Deno.env.get("SERVICE_KEY")!);
  const userToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!userToken) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers: corsHeaders });

  const { data: { user } } = await supabaseAdmin.auth.getUser(userToken);
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const credits = user.user_metadata?.credits ?? 0;
  if (credits <= 0) return new Response(JSON.stringify({ error: "No credits" }), { status: 402, headers: corsHeaders });

  const body = await req.json();
  const { nombre, email, categoria_producto, material, sugerencias, imagen_subida_url, gema_principal } = body;

  const supabase = createClient(Deno.env.get("URL")!, Deno.env.get("SERVICE_KEY")!);
  const apiKey = Deno.env.get("GEMINI_API_KEY")!;

  const isRedesign = sugerencias?.includes("Cambios solicitados:");
  const userNotes = isRedesign
    ? sugerencias.split("Cambios solicitados:")[1].trim()
    : (sugerencias || "").trim();

  const cat = CATEGORIES[categoria_producto] || categoria_producto || "medallion";
  const mat = MATERIALS[material] || material || "18k yellow gold";

  // ── Fetch reference image once (if provided) ────────────────────────────
  let imagePart: unknown | null = null;
  if (imagen_subida_url && !isRedesign) {
    try {
      const imgRes = await fetch(imagen_subida_url);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const b64 = encode(new Uint8Array(buf));
        const mime = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
        imagePart = { inlineData: { mimeType: mime, data: b64 } };
        console.log("Reference image loaded. Size:", buf.byteLength, "mime:", mime);
      } else {
        console.error("Could not fetch reference image, HTTP:", imgRes.status);
      }
    } catch (e) {
      console.error("Exception fetching reference image:", e);
    }
  }

  // ── Build base prompt depending on mode ─────────────────────────────────
  let baseContext: string;

  if (imagePart && !isRedesign) {
    baseContext = `You are a master jewelry engraver and 3D photorealistic render artist.
The attached photograph shows the SUBJECT to be engraved on a ${cat} made of ${mat}.
Study every detail in the photo and reproduce it faithfully as a high-detail bas-relief metal engraving — the same as you see on commemorative medals or coins.
The engraving must match the EXACT likeness, proportions, and features from the photo. Do NOT generalize or invent.
${userNotes ? `Client notes: "${userNotes}"` : ""}
The surrounding jewelry surface must be clean polished ${mat}. Studio white background. Photorealistic render.`;
  } else if (isRedesign) {
    baseContext = `You are a master jewelry designer.
Apply ONLY these requested changes to the existing design: "${userNotes}"
Material: ${mat}. Product: ${cat}.
Keep everything else identical. White background, studio lighting, photorealistic.`;
  } else {
    baseContext = `You are a master jewelry designer for Romet Joyería.
Create a PHOTOREALISTIC studio render of a handcrafted ${cat} made of ${mat}.
${gema_principal ? `Main gemstone: ${gema_principal}.` : ""}
${userNotes ? `Design notes: "${userNotes}"` : "Keep it elegant and classic."}
White background, studio lighting. No human figures — only the jewelry piece.`;
  }

  // ── Generate 3 views in parallel ─────────────────────────────────────────
  const [frontB64, backB64, sideB64] = await Promise.all([
    generateView(
      `${baseContext}\n\nRENDER: FRONT VIEW — show the jewelry piece from the front, perfectly centered on white background.`,
      imagePart,
      apiKey
    ),
    generateView(
      `${baseContext}\n\nRENDER: BACK VIEW — show the exact same jewelry piece from the back/reverse side, on a white background.`,
      imagePart,
      apiKey
    ),
    generateView(
      `${baseContext}\n\nRENDER: SIDE PROFILE VIEW — show the jewelry piece from the side (90° angle), revealing its depth and thickness, on a white background.`,
      imagePart,
      apiKey
    ),
  ]);

  // ── Save generated images to storage ────────────────────────────────────
  async function saveImage(b64: string | null, label: string): Promise<string | null> {
    if (!b64) return null;
    try {
      const fname = `diseno_${Date.now()}_${label}.png`;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const { error } = await supabase.storage
        .from("disenos")
        .upload(fname, bytes, { contentType: "image/png" });
      if (error) { console.error(`Storage error (${label}):`, error); return null; }
      return supabase.storage.from("disenos").getPublicUrl(fname).data.publicUrl;
    } catch (e) {
      console.error(`Save exception (${label}):`, e);
      return null;
    }
  }

  const [imagenFrontal, imagenTrasera, imagenLateral] = await Promise.all([
    saveImage(frontB64, "front"),
    saveImage(backB64, "back"),
    saveImage(sideB64, "side"),
  ]);

  // Primary imagen URL = front view (for backward compat)
  const imagenUrl = imagenFrontal;

  console.log("Generated views — front:", !!imagenFrontal, "back:", !!imagenTrasera, "side:", !!imagenLateral);

  // ── Save to DB ────────────────────────────────────────────────────────────
  const { data: insertedData, error: dbError } = await supabase
    .from("solicitudes_disenos_romet")
    .insert({
      ...body,
      imagen_generada_url: imagenUrl,
      prompt_usado: baseContext,
    })
    .select()
    .single();

  if (dbError) console.error("DB insert error:", dbError);

  // ── Send email ────────────────────────────────────────────────────────────
  if (insertedData && email && !isRedesign) {
    // Human-readable labels for the email
    const CATEGORY_LABELS: Record<string, string> = {
      anillo: "Anillo", colgante: "Colgante", pendientes: "Pendientes",
      pulsera: "Pulsera", gemelos: "Gemelos", medallas: "Medalla",
    };
    const MATERIAL_LABELS: Record<string, string> = {
      oro_amarillo: "Oro Amarillo 18k", oro_blanco: "Oro Blanco 18k",
      oro_rosa: "Oro Rosa 18k", platino: "Platino 950", plata: "Plata 925",
    };
    try {
      const { error: emailError } = await supabaseAdmin.functions.invoke("send-email", {
        body: {
          type: imagen_subida_url ? "Sube tu Diseño" : "Diseño Guiado",
          to: email,
          customerName: nombre || "Cliente",
          customerPhone: body.telefono || "",
          orderId: insertedData.id,
          categoria: CATEGORY_LABELS[categoria_producto] || categoria_producto || "",
          material: MATERIAL_LABELS[material] || material || "",
          sugerencias: userNotes || "",
          imagenSubidaUrl: imagen_subida_url || null,
          imagenFrontal: imagenFrontal || null,
          imagenTrasera: imagenTrasera || null,
          imagenLateral: imagenLateral || null,
        },
      });
      if (emailError) console.error("send-email error:", emailError);
      else console.log("Emails dispatched to:", email, "+ owner");
    } catch (e) {
      console.error("Email invoke exception:", e);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      imagenUrl,
      imagenFrontal,
      imagenTrasera,
      imagenLateral,
      dbError,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
