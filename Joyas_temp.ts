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
STRICT RULES: No text, letters, logos, watermarks, or writing of any kind. 
White studio background. Photorealistic jewelry photography.`;

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
      console.error(`Gemini Error ${res.status}:`, JSON.stringify(data).slice(0, 500));
      return null;
    }

    const responseParts = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
    
    if (!imgPart) {
        console.warn("No image found in Gemini response parts. Parts:", JSON.stringify(responseParts).slice(0, 300));
    }

    return imgPart ? imgPart.inlineData.data : null;
  } catch (e: any) {
    console.error("Gemini exception:", e.message);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("Joyas v48: Processing request...");

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase environment variables.");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const authHeader = req.headers.get("Authorization");
    const userToken = authHeader?.replace("Bearer ", "");
    
    if (!userToken) {
      console.error("No token in request headers.");
      return new Response(JSON.stringify({ error: "No sessions token" }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);
    if (authError || !user) {
      console.error("Auth error:", authError?.message || "User not found");
      return new Response(JSON.stringify({ error: "Login failed or expired" }), { status: 401, headers: corsHeaders });
    }

    const credits = user.user_metadata?.credits ?? 0;
    if (credits <= 0) {
      console.log(`User ${user.email} out of credits.`);
      return new Response(JSON.stringify({ error: "No design credits left" }), { status: 402, headers: corsHeaders });
    }

    const body = await req.json();
    const { 
      nombre, email, categoria_producto, material, sugerencias, 
      imagen_subida_url, imagen_referencia_url,
      gema_principal, cambios_solicitados, is_redesign 
    } = body;

    const apiKey = Deno.env.get("GEMINI_API_KEY") || "AQ.Ab8RN6KnCjHIrCMeRibLbFaFUJNQPgSNHCVUh_IEbbGkSzzfA";

    const finalImageToProcess = imagen_subida_url || imagen_referencia_url;
    const isRedesignMode = is_redesign === true || !!cambios_solicitados;
    
    const userNotes = isRedesignMode
      ? (cambios_solicitados || sugerencias || "")
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
          console.log(`Reference image loaded: ${mime}`);
        }
      } catch (e) {
        console.error("Error fetching reference image:", e);
      }
    }

    let baseContext: string;
    if (isRedesignMode && imagePart) {
      baseContext = `Redesign this ${cat} in ${mat}. Changes: "${userNotes}". Keep original foundation. ${NO_TEXT_RULE}`;
    } else if (imagePart) {
      baseContext = `Faithful jewelry render of a ${cat} in ${mat} with this image as a bas-relief engraving. ${userNotes}. ${NO_TEXT_RULE}`;
    } else {
      baseContext = `Fine jewelry render of a ${cat} in ${mat}. ${gema_principal ? `Gem: ${gema_principal}.` : ""} ${userNotes}. ${NO_TEXT_RULE}`;
    }

    console.log(`Requesting Gemini for ${user.email}...`);

    // In v48, we generate ONE view first for speed and to check if it works
    const frontB64 = await generateView(`${baseContext}\nFront View.`, imagePart, apiKey);
    
    if (!frontB64) {
      throw new Error("Gemini Image Generation Failed. Please try a different description.");
    }

    // Now generate the rest
    const [backB64, sideB64] = await Promise.all([
      generateView(`${baseContext}\nBack View.`, imagePart, apiKey),
      generateView(`${baseContext}\nSide View.`, imagePart, apiKey),
    ]);

    async function saveImage(b64: string | null, label: string): Promise<string | null> {
      if (!b64) return null;
      try {
        const fname = `diseno_${Date.now()}_${label}.png`;
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const { error: uploadError } = await supabaseAdmin.storage.from("disenos").upload(fname, bytes, { contentType: "image/png" });
        if (uploadError) throw uploadError;
        return supabaseAdmin.storage.from("disenos").getPublicUrl(fname).data.publicUrl;
      } catch (e) {
        console.error(`Save error ${label}:`, e);
        return null;
      }
    }

    const [imagenFrontal, imagenTrasera, imagenLateral] = await Promise.all([
      saveImage(frontB64, "front"),
      saveImage(backB64, "back"),
      saveImage(sideB64, "side"),
    ]);

    const finalResult = { 
        success: true, 
        imagenUrl: imagenFrontal, 
        imagenFrontal, imagenTrasera, imagenLateral, 
        isRedesign: isRedesignMode 
    };

    // Save to DB
    await supabaseAdmin.from("solicitudes_disenos_romet").insert({ 
        ...body, 
        imagen_generada_url: imagenFrontal, 
        prompt_usado: baseContext,
        is_redesign: isRedesignMode
    });

    return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("v48 Final Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
