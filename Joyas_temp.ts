import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goog-api-key",
};

const CATEGORIES: Record<string, string> = {
  anillo:     "ring", colgante: "pendant", pendientes: "earrings",
  pulsera:    "bracelet", gemelos: "cufflinks", medallas: "medallion",
};

const MATERIALS: Record<string, string> = {
  oro_amarillo: "18k yellow gold", oro_blanco: "18k white gold",
  oro_rosa: "18k rose gold", platino: "platinum", plata: "silver",
};

<<<<<<< HEAD
const MATERIAL_LABELS: Record<string, string> = {
  oro_amarillo: "Oro Amarillo 18k", oro_blanco: "Oro Blanco 18k",
  oro_rosa: "Oro Rosa 18k", platino: "Platino 950", plata: "Plata 925",
};

// gemini-2.5-flash-image: supports multimodal input (image+text) AND image output
// Switching to GA model gemini-3.1-flash-image (available since May 2026)
// This model supports native IMAGE output and maintains better consistency across parallel requests.
const GEMINI_MODEL = "gemini-3.1-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
  imagePart: unknown | null,
  apiKey: string
): Promise<string | null> {
  const parts: unknown[] = [];
  if (imagePart) parts.push(imagePart);
  parts.push({ text: prompt });
=======
const NO_TEXT_RULE = "STRICT: No text/logos. White background. Photorealistic.";
>>>>>>> 23cf71a677be8928bc0444024951d6cc0e39b8d3

async function generateView(prompt: string, imagePart: any | null, apiKey: string): Promise<string | null> {
  try {
<<<<<<< HEAD
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
=======
    // UPDATED: Using x-goog-api-key header for modern project-scoped keys (AQ...)
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey 
>>>>>>> 23cf71a677be8928bc0444024951d6cc0e39b8d3
      },
      body: JSON.stringify({
        contents: [{ parts: imagePart ? [imagePart, { text: prompt }] : [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], temperature: 0.4 },
      }),
    });
    
    const data = await res.json();
    if (!res.ok) {
        console.error("Gemini API Error:", JSON.stringify(data));
        return null;
    }
    
    const imgPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    return imgPart ? imgPart.inlineData.data : null;
  } catch (e) { 
    console.error("Gemini Fetch Exception:", e);
    return null; 
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("URL") || "";
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_KEY") || "";
    const apiKey = Deno.env.get("GEMINI_API_KEY") || "";

    if (!SUPABASE_URL || !SUPABASE_KEY || !apiKey) {
        throw new Error(`Missing Config: URL=${!!SUPABASE_URL}, KEY=${!!SUPABASE_KEY}, GEMINI=${!!apiKey}`);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);
    const authHeader = req.headers.get("Authorization");
    const userToken = authHeader?.replace("Bearer ", "");
    
    if (!userToken) throw new Error("No session token provided");

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(userToken);
    if (authError || !authData?.user) throw new Error(`Auth fail: ${authError?.message || "User unknown"}`);

    const user = authData.user;
    const credits = user.user_metadata?.credits ?? 0;
    if (credits <= 0) return new Response(JSON.stringify({ error: "No credits" }), { status: 402, headers: corsHeaders });

    const body = await req.json();
    const { categoria_producto, material, sugerencias, imagen_subida_url, gema_principal } = body;

    const cat = CATEGORIES[categoria_producto] || categoria_producto || "jewelry";
    const mat = MATERIALS[material] || material || "gold";
    const baseContext = `Handcrafted ${cat} in ${mat}. ${gema_principal ? `Gem: ${gema_principal}.` : ""} ${sugerencias || ""}. ${NO_TEXT_RULE}`;

    let imagePart = null;
    if (imagen_subida_url) {
      try {
        const imgRes = await fetch(imagen_subida_url);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          imagePart = { inlineData: { mimeType: "image/jpeg", data: encode(new Uint8Array(buf)) } };
        }
      } catch (e) {
        console.warn("Could not fetch reference image:", e);
      }
    }

    // Generate only Front View for maximum reliability in this phase
    const frontB64 = await generateView(`${baseContext}\nFront View.`, imagePart, apiKey);
    if (!frontB64) throw new Error("Gemini Image Generation Failed. Check your API key or model permissions.");

    const fname = `diseno_${Date.now()}_front.png`;
    const bytes = Uint8Array.from(atob(frontB64), (c) => c.charCodeAt(0));
    const { error: uploadError } = await supabaseAdmin.storage.from("disenos").upload(fname, bytes, { contentType: "image/png" });
    if (uploadError) throw new Error(`Storage Upload Fail: ${uploadError.message}`);

    const imagenUrl = supabaseAdmin.storage.from("disenos").getPublicUrl(fname).data.publicUrl;

    const { error: dbError } = await supabaseAdmin.from("solicitudes_disenos_romet").insert({ 
        ...body, 
        imagen_generada_url: imagenUrl, 
        prompt_usado: baseContext 
    });
    if (dbError) console.warn("DB Insert Error (non-fatal):", dbError.message);

    return new Response(JSON.stringify({ success: true, imagenUrl, imagenFrontal: imagenUrl }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error("v53 ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, headers: corsHeaders 
    });
  }
});
