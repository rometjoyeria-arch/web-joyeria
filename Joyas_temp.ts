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
1.  **CATALOG QUALITY**: Pure white background (#FFFFFF). Real product photography style. No filters, no humans, no magic.
2.  **TRI-VIEW PANELS**: Output a single image containing 3 side-by-side versions of the EXACT SAME piece: Front view, Back/Top view, and Side view.
3.  **MANUFACTURABLE**: No floating parts or impossible physical shapes. The piece must look like a solid, realistic, hyper-detailed piece of high-end jewelry.
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
You are an expert 3D jewelry engraver, sculptor, and designer. The client has provided a REFERENCE PHOTOGRAPH (e.g. a face, a child, a pet, a symbol).
YOUR #1 MISSION: Create a HIGH-END, PHOTOREALISTIC jewelry piece that incorporates a PERFECT, LITERAL ENGRAVING / CARVING of the provided photograph inside the metal.

EXTREMELY IMPORTANT INSTRUCTIONS:
1. **LITERAL REALISTIC TRANSFER (NO CARTOONS)**: Do NOT recreate the subject as a simple cartoon or icon. If a real child's face is uploaded, you MUST preserve all realistic facial features. Sculpt those exact details directly into the metal as a high-end bas-relief engraving.
2. **METAL MATERIAL REALISM**: The piece is made of ${MATERIALS[material] || material}. The engraved face/subject should look like hyper-detailed metal bas-relief sculpted beautifully over the core.
3. **ONLY USE THE IMAGE GIVEN**: Reproduce the portrait directly from the photograph. Capture every micro-detail, shading, and contour of the face.
4. **INTEGRATION**: Form it perfectly into a ${CATEGORIES[categoria_producto] || categoria_producto}.

${getBaseRules()}
    `.trim();
  } else if (isRedesign) {
    let contextNote = "";
    if (imagen_generada_url_previa && imagen_subida_url) {
        contextNote = "I am providing TWO images: Image 1 is the original client reference. Image 2 is your PREVIOUS DESIGN prediction.";
    } else if (imagen_generada_url_previa) {
        contextNote = "I am providing ONE image: This is your PREVIOUS DESIGN prediction.";
    } else if (imagen_subida_url) {
        contextNote = "I am providing ONE image: This is the original client reference.";
    }

    activePrompt = `
You are a master 3D jewelry designer. The client wants to MODIFY an existing design.
YOUR #1 MISSION: Apply the requested changes exactly, while keeping the rest of the design intact. DO NOT LOSE CONTEXT.

CONTEXT INFO: ${contextNote}

MODIFICATIONS REQUESTED: "${userNotes}"

BASE RULES:
1. Only change what is asked in the modifications. Keep the general structure from the previous images!
2. Keep it realizable, simple, and realistic. 
3. Material: ${MATERIALS[material] || material}.
4. Style: ${STYLES[estilo] || estilo || 'None'}.

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
- NOTES: "${userNotes || 'No special notes. Keep it simple/classic.'}"

${getBaseRules()}
    `.trim();
  }

  async function fetchImagePart(url: string) {
      if (!url) return null;
      try {
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const buf = await resp.arrayBuffer();
          // Use safe base64 encoding that avoids call stack exceeding for large files
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
    let parts: any[] = [{ text: activePrompt }];
    
    if (imagen_subida_url) {
        const p1 = await fetchImagePart(imagen_subida_url);
        if (p1) parts.push(p1);
    }
    if (imagen_generada_url_previa) {
        const p2 = await fetchImagePart(imagen_generada_url_previa);
        if (p2) parts.push(p2);
    }

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
    }
  } catch (e) { console.error("Final Gen Error:", e); }

  const { data: insertedData, error: dbError } = await supabase.from("solicitudes_disenos_romet").insert({ ...body, imagen_generada_url: imagenUrl, prompt_usado: activePrompt }).select().single();

  // Trigger send-email explicitly just in case webhooks are failing or missing
  if (insertedData && email && !isRedesign) {
      try {
          await fetch(Deno.env.get("URL") + "/functions/v1/send-email", {
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
      } catch (err) {
          console.error("Email Invocation Error:", err);
      }
  }

  return new Response(JSON.stringify({ success: true, imagenUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
