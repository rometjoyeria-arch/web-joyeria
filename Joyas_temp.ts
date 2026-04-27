import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────
// PARAMETER DEFINITIONS
const CATEGORIES: Record<string, string> = {
  anillo:     "Ring - a circular band for the finger.",
  colgante:   "Pendant - jewelry suspended from a chain.",
  pendientes: "Earrings - a pair of ornaments for the ears.",
  pulsera:    "Bracelet - jewelry for the wrist.",
  gemelos:    "Cufflinks - decorative fasteners for shirt cuffs.",
  medallas:   "Medallion - a flat circular disc for a necklace.",
};

const MATERIALS: Record<string, string> = {
  oro_amarillo: "18k yellow gold, warm mirror-polished finish.",
  oro_blanco:   "18k white gold, cool rhodium-plated silver-white finish.",
  oro_rosa:     "18k rose gold, pink-copper polished finish.",
  platino:      "Platinum 950, naturally white heavy-duty finish.",
  plata:        "Sterling silver 925, bright white polished finish.",
};

const STYLES: Record<string, string> = {
  moderno:    "Minimalist - focus on raw geometry, zero extra detail.",
  clasico:    "Classic - timeless proportions, clean and smooth.",
  naturaleza: "Nature - a single organic motif (leaf/branch/petal).",
};

function getBaseRules(): string {
  return `
- Keep the jewelry piece perfectly centered and strictly isolated on a white background. No human bodies in the background.
- It must look like a hyper-realistic commercial jewelry photograph.
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(Deno.env.get("URL")!, Deno.env.get("SERVICE_KEY")!);
  const authHeader = req.headers.get("Authorization");
  const userToken = authHeader?.replace("Bearer ", "");
  if (!userToken) return new Response(JSON.stringify({ error: "No token" }), { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(userToken);
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  let credits = user.user_metadata?.credits ?? 0;
  if (credits <= 0) return new Response(JSON.stringify({ error: "No credits" }), { status: 402 });

  const body = await req.json();
  const { nombre, email, categoria_producto, material, estilo, perfil_usuario, sugerencias, imagen_subida_url, imagen_generada_url_previa, gema_principal } = body;
  
  const supabase = createClient(Deno.env.get("URL")!, Deno.env.get("SERVICE_KEY")!);
  const isRedesign = sugerencias?.includes("Cambios solicitados:");
  const userNotes = isRedesign ? sugerencias.split("Cambios solicitados:")[1] : sugerencias;

  let activePrompt = "";

  if (imagen_subida_url && !isRedesign) {
      activePrompt = `
You are an expert 3D jewelry engraver and designer.
I have attached an image containing a real-life face or subject.
YOUR #1 MISSION: Create a HIGH-END, PHOTOREALISTIC jewelry piece that incorporates a PERFECT, LITERAL ENGRAVING / BAS-RELIEF CARVING of the ATTACHED IMAGE into the metal.

EXTREMELY IMPORTANT INSTRUCTIONS regarding the attached image:
1. **LITERAL TRANSFER (NO CARTOONS)**: You must preserve the EXACT shapes, facial features, and likeness from the attached photo. Extract the face/subject visually from the image itself.
2. **DO NOT INVENT**: Ignore text instructions if they tell you to invent a new face. Copy the face from the pixels.
3. **MATERIAL REALISM**: The piece is made of ${MATERIALS[material] || material}. The engraved subject should look like realistic metal carving natively integrated into the jewelry.
4. **INTEGRATION**: Form it perfectly into a ${CATEGORIES[categoria_producto] || categoria_producto}. Note from user: "${userNotes}"

${getBaseRules()}
    `.trim();
  } else if (isRedesign) {
    activePrompt = `
You are a master 3D jewelry designer. The client wants to MODIFY an existing design.
I am providing previous images for context. Apply the requested changes exactly, while keeping the rest of the original design intact!

MODIFICATIONS REQUESTED: "${userNotes}"

BASE RULES:
1. Keep the general structure from the previous images!
2. Material: ${MATERIALS[material] || material}.
3. Style: ${STYLES[estilo] || estilo || 'None'}.

${getBaseRules()}
    `.trim();
  } else {
    activePrompt = `
You are a master 3D jewelry designer for "Romet Joyería". 
YOUR #1 MISSION: Create a simple, basic, and realistic jewelry piece from scratch.

SPECIFICATIONS:
- CATEGORY: ${CATEGORIES[categoria_producto] || categoria_producto}
- MATERIAL: ${MATERIALS[material] || material}
- STYLE: ${STYLES[estilo] || estilo}
- PROFILE: ${perfil_usuario}
- GEMA: ${gema_principal || 'No gem'}
- NOTES: "${userNotes || 'No special notes. Keep it simple.'}"

${getBaseRules()}
    `.trim();
  }

  async function fetchImagePart(url: string) {
      if (!url) return null;
      try {
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const buf = await resp.arrayBuffer();
          const b64 = encode(new Uint8Array(buf));
          const mime = resp.headers.get("content-type")?.split(";")[0] || "image/jpeg";
          return { inlineData: { mimeType: mime, data: b64 } };
      } catch (e) {
          console.error("Image Fetch Error:", e);
          return null;
      }
  }

  let imagenUrl: string | null = null;
  try {
    // IMPORTANT: Images go first in the parts array so the model sees them before reading the prompt.
    let parts: any[] = [];
    
    if (imagen_subida_url) {
        const p1 = await fetchImagePart(imagen_subida_url);
        if (p1) parts.push(p1);
    }
    if (imagen_generada_url_previa) {
        const p2 = await fetchImagePart(imagen_generada_url_previa);
        if (p2) parts.push(p2);
    }

    parts.push({ text: activePrompt });
    const gemContents = [{ parts }];

    const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: gemContents, generationConfig: { responseModalities: ["IMAGE"] } })
    });
    
    const gd = await gr.json();
    const data = gd.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (data) {
      const fname = `diseno_${Date.now()}.png`;
      const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
      await supabase.storage.from("disenos").upload(fname, bytes, { contentType: data.mimeType });
      imagenUrl = supabase.storage.from("disenos").getPublicUrl(fname).data.publicUrl;
    } else {
      console.error("Gemini failed or blocked request:", gd);
    }
  } catch (e) { console.error("Final Gen Error:", e); }

  const { data: insertedData, error: dbError } = await supabase.from("solicitudes_disenos_romet").insert({ ...body, imagen_generada_url: imagenUrl, prompt_usado: activePrompt }).select().single();

  if (insertedData && email && !isRedesign) {
      try {
          const emailResponse = await fetch(Deno.env.get("URL") + "/functions/v1/send-email", {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${Deno.env.get("SERVICE_KEY")}`,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({
                  type: imagen_subida_url ? "Sube tu Diseño" : "Diseño Guiado",
                  to: email,
                  customerName: nombre || "Cliente",
                  orderId: insertedData.id,
                  orderData: { ...body, imagenUrl }
              })
          });
          if (!emailResponse.ok) {
              const resTxt = await emailResponse.text();
              console.error("Email Invocation returned non-OK:", resTxt);
          }
      } catch (err) {
          console.error("Email Invocation Error:", err);
      }
  }

  return new Response(JSON.stringify({ success: true, imagenUrl, dbError }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
