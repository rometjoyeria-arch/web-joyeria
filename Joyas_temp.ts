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

// gemini-3.1-flash-image: supports multimodal input (image+text) AND image output
const GEMINI_MODEL = "gemini-3.1-flash-image";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

// Rule appended to EVERY prompt to prevent Gemini adding text/logos/watermarks
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
            responseModalities: ["IMAGE", "TEXT"],
            temperature: 0.4,
            maxOutputTokens: 2048
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Gemini Error ${res.status}:`, JSON.stringify(data));
      return null;
    }

    const responseParts = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    return imgPart ? imgPart.inlineData.data : null;
  } catch (e: any) {
    console.error("Gemini exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("Joyas function v47 started...");

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_KEY")!;
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    
    if (!userToken) {
      console.error("No authorization token provided.");
      return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);
    if (authError || !user) {
      console.error("Auth error:", authError?.message || "User not found");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const credits = user.user_metadata?.credits ?? 0;
    if (credits <= 0) {
      console.log(`User ${user.email} has no credits: ${credits}`);
      return new Response(JSON.stringify({ error: "No credits" }), { status: 402, headers: corsHeaders });
    }

    const body = await req.json();
    const { 
      nombre, email, categoria_producto, material, sugerencias, 
      imagen_subida_url, imagen_referencia_url,
      gema_principal, cambios_solicitados, is_redesign 
    } = body;

    const apiKey = Deno.env.get("GEMINI_API_KEY") || "AQ.Ab8RN6KnCjHIrCMeRibLbFaFUJNQPgSNHCVUh_IEbbGkSzzfA";

    // Support for both naming conventions
    const finalImageToProcess = imagen_subida_url || imagen_referencia_url;
    
    // Detect redesign mode
    const isRedesignMode = is_redesign === true || 
                         !!cambios_solicitados || 
                         sugerencias?.includes("Cambios solicitados:");
    
    const userNotes = isRedesignMode
      ? (cambios_solicitados || sugerencias?.split("Cambios solicitados:")?.[1]?.trim() || sugerencias || "")
      : (sugerencias || "").trim();

    const cat = CATEGORIES[categoria_producto] || categoria_producto || "medallion";
    const mat = MATERIALS[material] || material || "18k yellow gold";

    let imagePart: any | null = null;
    if (finalImageToProcess) {
      try {
        const imgRes = await fetch(finalImageToProcess);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const b64 = encode(new Uint8Array(buf));
          const mime = imgRes.headers.get("content-type")?.split(";")?.[0] || "image/jpeg";
          imagePart = { inlineData: { mimeType: mime, data: b64 } };
        }
      } catch (e) {
        console.error("Image fetch error:", e);
      }
    }

    let baseContext: string;

    if (isRedesignMode && imagePart) {
      baseContext = `You are a master jewelry designer and 3D render artist.
The attached image shows the PREVIOUSLY GENERATED design of a ${cat} made of ${mat}.
This is your starting point. Apply ONLY the following changes to it, keeping EVERYTHING ELSE as identical to the original as possible:

"${userNotes}"

Do not add new decorations, change the material, or alter aspects not mentioned.
${NO_TEXT_RULE}`;

    } else if (isRedesignMode) {
      baseContext = `You are a master jewelry designer.
Apply ONLY these specific changes to the existing ${cat} design made in ${mat}, keeping everything else identical:
"${userNotes}"
${NO_TEXT_RULE}`;

    } else if (imagePart) {
      baseContext = `You are a master jewelry engraver and 3D photorealistic render artist.
TASK: Produce a photorealistic render of a ${cat} made of ${mat}.
The attached photograph is the REFERENCE SUBJECT that must be engraved as a bas-relief on the face of the jewelry piece.
You MUST study every detail of the attached photo and reproduce it faithfully as a precision metal bas-relief carving.
${userNotes ? `Additional client instruction: "${userNotes}"` : ""}
The rest of the jewelry surface must be clean, polished ${mat}.
${NO_TEXT_RULE}`;

    } else {
      baseContext = `You are a master fine jewelry designer and 3D render artist.
TASK: Create a photorealistic studio render of a handcrafted ${cat} made of ${mat}.
${gema_principal ? `Main gemstone: ${gema_principal}.` : "No gemstone — pure metal design."}
${userNotes ? `Design brief: "${userNotes}"` : "Style: elegant, classic, timeless. Clean and minimal."}
${NO_TEXT_RULE}`;
    }

    console.log(`Generating images for ${user.email}... Mode: ${isRedesignMode ? "Redesign" : "Original"}`);

    // Generate 3 views - sequential to avoid rate limits if any, or Promise.all if high tier
    // We'll stick to Promise.all but handle nulls
    const [frontB64, backB64, sideB64] = await Promise.all([
      generateView(`${baseContext}\n\nRENDER: FRONT VIEW — jewelry piece from directly in front, centered, white background.`, imagePart, apiKey),
      generateView(`${baseContext}\n\nRENDER: BACK VIEW — same jewelry piece from the back side, white background.`, imagePart, apiKey),
      generateView(`${baseContext}\n\nRENDER: SIDE VIEW — jewelry piece from the side (90 degree), white background.`, imagePart, apiKey),
    ]);

    if (!frontB64 && !backB64 && !sideB64) {
      throw new Error("Gemini failed to generate any images.");
    }

    async function saveImage(b64: string | null, label: string): Promise<string | null> {
      if (!b64) return null;
      try {
        const fname = `diseno_${Date.now()}_${label}.png`;
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const { error: uploadError } = await supabaseAdmin.storage.from("disenos").upload(fname, bytes, { contentType: "image/png" });
        if (uploadError) throw uploadError;
        return supabaseAdmin.storage.from("disenos").getPublicUrl(fname).data.publicUrl;
      } catch (e) {
        console.error(`Storage error (${label}):`, e);
        return null;
      }
    }

    const [imagenFrontal, imagenTrasera, imagenLateral] = await Promise.all([
      saveImage(frontB64, "front"),
      saveImage(backB64, "back"),
      saveImage(sideB64, "side"),
    ]);

    const imagenUrl = imagenFrontal || imagenTrasera || imagenLateral;

    // Save to DB
    const { data: insertedData, error: dbError } = await supabaseAdmin
      .from("solicitudes_disenos_romet")
      .insert({ 
          ...body, 
          imagen_generada_url: imagenUrl, 
          prompt_usado: baseContext,
          is_redesign: isRedesignMode
      })
      .select().single();

    if (dbError) console.error("DB Error:", dbError.message);

    // Send email
    if (insertedData && email && !isRedesignMode) {
      try {
        await supabaseAdmin.functions.invoke("send-email", {
          body: {
            type: finalImageToProcess ? "Sube tu Diseño" : "Diseño Guiado",
            to: email,
            customerName: nombre || "Cliente",
            customerPhone: body.telefono || "",
            orderId: insertedData.id,
            categoria: CATEGORY_LABELS[categoria_producto] || categoria_producto || "",
            material: MATERIAL_LABELS[material] || material || "",
            sugerencias: userNotes || "",
            imagenSubidaUrl: finalImageToProcess || null,
            imagenFrontal, imagenTrasera, imagenLateral
          },
        });
      } catch (e) {
        console.error("Email error:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, imagenUrl, imagenFrontal, imagenTrasera, imagenLateral, isRedesign: isRedesignMode }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
