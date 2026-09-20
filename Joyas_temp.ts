import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// ═══════════════════════════════════════════════════════════
// ROMET JOYERÍA — Edge Function v83
// Glosario maestro ampliado de joyería (+45 términos técnicos y visuales)
// Detección tolerante a tildes, plurales y sinónimos de taller
// 3 modos de prompt + emails directos Resend + restricciones geométricas
// Modelo: gemini-3.1-flash-image (confirmado funcional)
// ═══════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══ GLOSARIO MAESTRO DE JOYERÍA (AMPLIADO TÉCNICO & VISUAL) ════════════
function normalizarTextoParaGlosario(txt: string): string {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // elimina diacríticos/tildes
}

interface GlosarioItem {
  id: string;
  termino: string;
  patrones: RegExp[];
  definicion: string;
}

const GLOSARIO_TERMINOS: GlosarioItem[] = [
  // ── ANATOMÍA Y PERFILES DE ARO ───────────────────────────
  {
    id: "media_cana",
    termino: "media caña",
    patrones: [/\b(?:aro\s+|brazo\s+|perfil\s+)?media[\s-]ca[nñ]a\b/i, /\bmediaca[nñ]a\b/i, /\bd[\s-]shape\b/i],
    definicion: "MEDIA CAÑA (half-round / D-shape shank): a rounded convex exterior profile along the band with a flat interior resting against the finger. Smooth, polished, domed rim — NOT flat, NOT sharp, NOT a drinking glass or fishing rod."
  },
  {
    id: "brazo_plano",
    termino: "brazo plano",
    patrones: [/\b(?:brazo|aro|perfil|anillo)s?\s+plan[oas]{1,2}\b/i, /\bflat\s+band\b/i, /\bflat\s+shank\b/i],
    definicion: "BRAZO PLANO (flat rectangular shank): perfectly flat outer and inner surfaces with crisp, defined 90-degree outer edges. Modern minimalist geometric profile."
  },
  {
    id: "brazo_cuchillo",
    termino: "brazo cuchillo",
    patrones: [/\b(?:brazo\s+|aro\s+|perfil\s+|filo\s+de\s+)?cuchillo[s]?\b/i, /\bknife[\s-]edge\b/i],
    definicion: "BRAZO CUCHILLO (knife-edge shank): triangular cross-section band featuring two sloping facets converging at a sharp, crisp central perimeter ridge. Crisp reflective center line — NOT a kitchen knife, strictly a jewelry band profile."
  },
  {
    id: "aro_confort",
    termino: "aro confort",
    patrones: [/\b(?:aros?|cortes?|ajustes?|perfiles?)\s+confort\b/i, /\bcomfort[\s-]fit\b/i, /\binterior\s+curvo\b/i],
    definicion: "ARO CONFORT (comfort-fit shank): domed, slightly convex curvature on the interior surface in contact with the finger for maximum ergonomic wear."
  },
  {
    id: "aro_cuadrado",
    termino: "aro cuadrado",
    patrones: [/\b(?:aros?|perfiles?)\s+cuadrad[oas]{1,2}\b/i, /\bperfil\s+frances\b/i, /\beuro[\s-]shank\b/i],
    definicion: "ARO CUADRADO / PERFIL FRANCÉS (Euro-shank): circular interior opening for the finger, but an outer square profile with subtle flat base corners preventing rotation."
  },
  {
    id: "salomonico",
    termino: "salomónico / entorchado",
    patrones: [/\bsalomonico[as]?\b/i, /\bentorchad[oas]{1,2}\b/i, /\b(?:brazo|aro|hilo)s?\s+retorcid[oas]{1,2}\b/i, /\bcable\s+twist\b/i, /\btorzales?\b/i],
    definicion: "SALOMÓNICO / ENTORCHADO (twisted rope wire): dynamic helical braided metal wire pattern spiraling around the band, creating rhythmic spiral highlights and shadows."
  },
  {
    id: "split_shank",
    termino: "doble aro / split shank",
    patrones: [/\bdobles?\s+aros?\b/i, /\b(?:aros?|brazos?)\s+hendid[oas]{1,2}\b/i, /\bbrazos?\s+dividid[oas]{1,2}\b/i, /\bsplit[\s-]shank\b/i],
    definicion: "DOBLE ARO / SPLIT SHANK (split shank): the metal band bifurcates into two distinct, graceful branches as it approaches the head/shoulders, creating an open airy gap."
  },
  {
    id: "bypass_tu_y_yo",
    termino: "anillo bypass / tú y yo",
    patrones: [/\btu\s+y\s+yo\b/i, /\bbypass\b/i, /\btoi\s+et\s+moi\b/i, /\baros?\s+abiert[oas]{1,2}\b/i],
    definicion: "ANILLO BYPASS / TÚ Y YO (Toi et Moi bypass ring): open spiral band whose two ends bypass each other diagonally at the head without touching, each holding a distinct complementary focal gemstone. NOT two people hugging."
  },
  {
    id: "brazo_ahusado",
    termino: "brazo ahusado",
    patrones: [/\b(?:brazos?|aros?)\s+ahusad[oas]{1,2}\b/i, /\bcono\s+invertido\b/i, /\bbrazos?\s+afinad[oas]{1,2}\b/i, /\btapered\s+shank\b/i],
    definicion: "BRAZO AHUSADO (tapered shank): the metal band progressively narrows in width as it approaches the center gemstone, accentuating the central stone."
  },
  {
    id: "brazo_inverso",
    termino: "brazo inverso",
    patrones: [/\b(?:brazos?|aros?)\s+(?:invers[oas]{1,2}|ahusad[oas]{1,2}\s+invers[oas]{1,2})\b/i, /\breverse\s+tapered\b/i],
    definicion: "BRAZO INVERSO (reverse tapered shank): the band gradually widens and thickens as it reaches the shoulders, giving a bold, architectural transition."
  },
  {
    id: "galeria_calada",
    termino: "galería / calado",
    patrones: [/\bgalerias?\b/i, /\bcalados?\s+de\s+galeria\b/i, /\bcanastillas?\b/i, /\bopenwork\s+gallery\b/i],
    definicion: "GALERÍA / CALADO (openwork gallery): decorative openwork filigree windows beneath the stone seat, allowing ambient light to enter the pavilion from underneath. NOT an art gallery."
  },
  {
    id: "forro_interior",
    termino: "forro interior / revestimiento",
    patrones: [/\bforros?\s+interiores?\b/i, /\brevestimientos?\b/i, /\bbajo\s+galerias?\b/i, /\bundergallery\b/i],
    definicion: "FORRO INTERIOR / REVESTIMIENTO (undergallery / backplate): finely pierced, high-polished decorative metal grill covering the interior cavity beneath the head."
  },
  {
    id: "virola",
    termino: "virola",
    patrones: [/\bvirolas?\b/i, /\bchasis\s+de\s+asiento\b/i],
    definicion: "VIROLA (bezel collar / under-bezel): slim reinforcing metal rim supporting the base of the setting basket."
  },

  // ── SISTEMAS DE ENGASTE Y MONTURAS ──────────────────────
  {
    id: "chaton",
    termino: "chatón / canasta",
    patrones: [/\bchaton(?:es)?\b/i, /\bcollet\b/i, /\bcanastas?\b/i],
    definicion: "CHATÓN (chaton / collet basket setting): elevated conical or cylindrical metal basket with integral prongs securely holding the gemstone, allowing maximum light entry. NOT a kitten."
  },
  {
    id: "garras",
    termino: "garras / uñetas",
    patrones: [/\b(?:4|cuatro|6|seis)?\s*garras?\b/i, /\bu[nñ]etas?\b/i, /\bprongs?\b/i, /\bclaws?\b/i],
    definicion: "GARRAS / UÑETAS (prongs / claws): delicate, precisely bent metal claws gripping the gemstone girdle with rounded or eagle-claw tips. NOT animal claws."
  },
  {
    id: "bisel",
    termino: "bisel / bocel",
    patrones: [/\bbisel(?:es)?\b/i, /\bbocel(?:es)?\b/i, /\bengaste\s+(?:a\s+|en\s+)?bisel\b/i, /\bengaste\s+ciego\b/i, /\bbezel\b/i],
    definicion: "BISEL / BOCEL (bezel setting): complete continuous collar of polished metal closely wrapping and securing the entire girdle of the gemstone with a sleek, protective rim."
  },
  {
    id: "bisel_dentado",
    termino: "bisel dentado",
    patrones: [/\bbisel(?:es)?\s+dentad[oas]{1,2}\b/i, /\bbocel(?:es)?\s+dentad[oas]{1,2}\b/i, /\bserrated\s+bezel\b/i],
    definicion: "BISEL DENTADO (serrated bezel): thin metal bezel wall with fine decorative scalloped or saw-tooth notched border crimped over the stone's contour."
  },
  {
    id: "carril",
    termino: "carril / canal",
    patrones: [/\b(?:engaste\s+en\s+)?carril(?:es)?\b/i, /\bcanales?\s+de\s+engaste\b/i, /\bchannel\s+setting\b/i],
    definicion: "CARRIL / CANAL (channel setting): gemstones mounted flush side-by-side between two smooth, parallel metal walls without any intermediate prongs. NOT train tracks."
  },
  {
    id: "pave_granos",
    termino: "pavé / granos",
    patrones: [/\bpave\b/i, /\bengaste\s+(?:en\s+|de\s+)?granos?\b/i, /\bgranos?\b/i, /\bmicrogranos?\b/i, /\bbead[\s-]set\b/i],
    definicion: "PAVÉ / GRANOS (micro-pavé bead setting): gemstones closely clustered with minimal visible metal, secured by tiny polished spherical metal beads raised with a graver. NOT cereal grains or acne."
  },
  {
    id: "tension",
    termino: "engaste en tensión",
    patrones: [/\bengaste\s+(?:en\s+|por\s+)?tension\b/i, /\btension\s+setting\b/i],
    definicion: "ENGASTE EN TENSIÓN (tension setting): gemstone suspended seemingly in mid-air, held purely by the physical compression force of the two opposing thick ends of the metal shank."
  },
  {
    id: "invisible",
    termino: "engaste invisible",
    patrones: [/\bengaste\s+invisible\b/i, /\bmalla\s+invisible\b/i, /\binvisible\s+setting\b/i],
    definicion: "ENGASTE INVISIBLE (invisible setting): square or princess-cut stones grooved underneath and snapped onto a hidden grid, forming a continuous faceted surface with zero metal visible."
  },
  {
    id: "cazoleta_pernero",
    termino: "cazoleta y pernero",
    patrones: [/\bcazoletas?\b/i, /\bperneros?\b/i, /\bespigos?\b/i, /\bengaste\s+de\s+perlas?\b/i],
    definicion: "CAZOLETA Y PERNERO (cup and peg setting): concave hemispherical metal cup with a central post/peg securely seating a pearl or cabochon."
  },
  {
    id: "roseton",
    termino: "rosetón",
    patrones: [/\broseton(?:es)?\b/i, /\bracimos?\b/i, /\bcluster\s+head\b/i],
    definicion: "ROSETÓN (cluster head): dominant central gemstone encircled by a concentric ring of smaller accent stones, forming an ornamental flower or starburst motif."
  },
  {
    id: "orla_halo",
    termino: "orla / halo",
    patrones: [/\borlas?\b/i, /\bhalos?\b/i, /\bcercos?\s+de\s+brillantes\b/i],
    definicion: "ORLA / HALO (halo setting): perimeter frame of micropavé diamonds tightly encircling the center gem, following its exact geometric contour. NOT a floating angelic halo."
  },
  {
    id: "solitario",
    termino: "solitario",
    patrones: [/\banillos?\s+solitarios?\b/i, /\bsolitarios?\b/i],
    definicion: "SOLITARIO (solitaire ring): classic ring featuring a single magnificent center gemstone mounted on a pristine band with no competing side stones."
  },
  {
    id: "media_alianza",
    termino: "media alianza",
    patrones: [/\bmedia\s+alianza\b/i, /\beternity\s+parcial\b/i, /\bhalf\s+eternity\b/i],
    definicion: "MEDIA ALIANZA (half-eternity band): continuous row of uniform faceted gemstones covering only the top 50% of the shank, with the bottom half remaining smooth polished metal."
  },
  {
    id: "alianza_completa",
    termino: "alianza completa",
    patrones: [/\balianza\s+completa\b/i, /\bfull\s+eternity\b/i, /\beternity\s+ring\b/i],
    definicion: "ALIANZA COMPLETA (full-eternity ring): 360-degree unbroken, continuous circle of identical faceted gemstones wrapping around the entire circumference of the ring."
  },

  // ── CIERRES Y FORNITURAS VISIBLES ────────────────────────
  {
    id: "submarino",
    termino: "submarino",
    patrones: [/\b(?:cierre\s+)?submarinos?\b/i],
    definicion: "SUBMARINO (cufflink closure): a chain-and-bar fitting consisting of a flat T-shaped bar connected by a small chain (5 links) to the decorative face. The bar passes through the buttonhole and lies flat. ABSOLUTELY NOT an aquatic vessel."
  },
  {
    id: "horquilla",
    termino: "horquilla de gemelo",
    patrones: [/\bhorquillas?\b/i, /\bcierre\s+torpedo\b/i, /\bswivel\s+bar\b/i],
    definicion: "HORQUILLA (rigid cufflink fitting): a rigid hinged post with a spring mechanism and swivel torpedo bar attached to the back of the cufflink face. No chain."
  },
  {
    id: "mosqueton",
    termino: "cierre de mosquetón",
    patrones: [/\b(?:cierres?\s+(?:de\s+)?)?mosqueton(?:es)?\b/i, /\blobster\s+clasp\b/i],
    definicion: "CIERRE DE MOSQUETÓN (lobster claw clasp): spring-loaded mechanical clasp with a curved shell-like profile and a small side trigger lever securing an opposing jump ring. NOT a lobster crustacean."
  },
  {
    id: "mosqueton_perico",
    termino: "mosquetón perico",
    patrones: [/\bmosqueton(?:es)?\s+perico\b/i, /\bparrot\s+clasp\b/i],
    definicion: "MOSQUETÓN PERICO (parrot clasp): elongated clasp with an arched profile resembling a parrot's beak, offering a wide secure opening."
  },
  {
    id: "reasa",
    termino: "cierre de reasa",
    patrones: [/\b(?:cierres?\s+(?:de\s+)?)?reasas?\b/i, /\bspring\s+ring\b/i],
    definicion: "CIERRE DE REASA (spring ring clasp): circular hollow metal ring with an internal spring mechanism operated by a tiny protruding sliding lever."
  },
  {
    id: "palanca_toggle",
    termino: "cierre de palanca / timón",
    patrones: [/\b(?:cierres?\s+(?:de\s+)?)?(?:palanca|timon|marinero)\b/i, /\btoggle\s+clasp\b/i],
    definicion: "CIERRE DE PALANCA / TIMÓN (toggle clasp): decorative T-shaped metal bar slipping through a matching circular or shaped metal ring, held securely by tension."
  },
  {
    id: "cierre_caja",
    termino: "cierre de caja",
    patrones: [/\bcierres?\s+de\s+caja\b/i, /\bbox\s+clasp\b/i],
    definicion: "CIERRE DE CAJA (box clasp): rectangular tongue-and-groove clasp where a spring metal tongue snaps into a hollow rectangular box receiver."
  },
  {
    id: "seguro_ocho",
    termino: "seguro de figura en ocho",
    patrones: [/\bseguros?\s+(?:de\s+|en\s+)?(?:figura\s+)?ocho\b/i, /\bfigura\s+ocho\b/i, /\bfigura[\s-]eight\b/i],
    definicion: "SEGURO DE FIGURA EN OCHO (figure-eight safety catch): small hinged metal wire loop shaped like an 8, pivoting to snap tightly over a ball stud on the side of the box clasp for double security. NOT a floating giant number 8."
  },
  {
    id: "cierre_bayoneta",
    termino: "cierre de bayoneta",
    patrones: [/\bcierres?\s+(?:de\s+)?bayoneta\b/i, /\bbayonet\s+clasp\b/i],
    definicion: "CIERRE DE BAYONETA (bayonet clasp): sleek tubular inline clasp connecting two ends with a push-and-twist interlocking locking pin mechanism."
  },
  {
    id: "cierre_catalan",
    termino: "cierre catalán / ballestilla",
    patrones: [/\b(?:cierres?|ganchos?)\s+catalan(?:es)?\b/i, /\bball?estillas?\b/i, /\blatch[\s-]back\b/i],
    definicion: "CIERRE CATALÁN / BALLESTILLA (latch-back / Catalan ear wire): curved hinged post that snaps firmly into an articulated rear spring-loaded fork or notch behind the earlobe."
  },
  {
    id: "gancho_frances",
    termino: "gancho francés",
    patrones: [/\bganchos?\s+frances(?:es)?\b/i, /\bganchos?\s+hippie\b/i, /\bfrench\s+hook\b/i, /\bfishhook\b/i],
    definicion: "GANCHO FRANCÉS (French hook / ear wire): graceful curved metal wire arching through the pierced earlobe, extending behind the ear with an open hanging loop."
  },
  {
    id: "tuerca_mariposa",
    termino: "perno y tuerca mariposa",
    patrones: [/\btuercas?\s+mariposa\b/i, /\bpresion\s+mariposa\b/i, /\bpalillos?\s+y\s+tuerca\b/i, /\bbutterfly\s+clutch\b/i],
    definicion: "PERNO Y TUERCA MARIPOSA (earring post and butterfly clutch): straight cylindrical post with a friction-fit winged butterfly back clutch securing it flat against the earlobe."
  },
  {
    id: "cierre_omega",
    termino: "cierre omega",
    patrones: [/\bcierres?\s+omega\b/i, /\bclips?\s+omega\b/i, /\bpatillas?\s+omega\b/i],
    definicion: "CIERRE OMEGA (Omega earring back): hinged wire loop shaped like the Greek letter Omega (Ω) that flips upward to press the earlobe gently against the decorative earring face."
  },
  {
    id: "criollas",
    termino: "criollas / aros",
    patrones: [/\bcriollas?\b/i, /\baros?\s+de\s+pendiente\b/i, /\bhoop\s+earrings?\b/i],
    definicion: "CRIOLLAS / AROS (hoop earrings): circular or semi-circular metal hoops with an integrated hidden hinge or click-in top bar closure."
  },
  {
    id: "portacolgante_bail",
    termino: "portacolgante / bail",
    patrones: [/\bportacolgantes?\b/i, /\bbails?\b/i, /\basas?\s+de\s+colgante\b/i],
    definicion: "PORTACOLGANTE / BAIL (pendant bail): tapered conical loop or hinged pinch bail connecting the top of the pendant to the chain, through which the chain slides smoothly."
  },

  // ── TEJIDOS DE CADENAS ───────────────────────────────────
  {
    id: "cadena_cable",
    termino: "cadena forzada / cable",
    patrones: [/\bcadenas?\s+forzada\b/i, /\beslabon(?:es)?\s+cable\b/i, /\bcable\s+chain\b/i],
    definicion: "CADENA FORZADA / CABLE (cable chain): classic chain composed of uniform, interlocking oval metal links alternated at precise 90-degree angles."
  },
  {
    id: "cadena_rolo",
    termino: "cadena rolo",
    patrones: [/\bcadenas?\s+rolo\b/i, /\beslabon(?:es)?\s+rolo\b/i, /\bbelcher\b/i],
    definicion: "CADENA ROLO (rolo / belcher chain): robust chain made of uniform symmetrical round or half-round circular links linked together."
  },
  {
    id: "cadena_barbada_cubana",
    termino: "cadena barbada / cubana",
    patrones: [/\bcadenas?\s+barbada\b/i, /\bcadenas?\s+cubana\b/i, /\bcuban\s+link\b/i, /\bgourmette\b/i],
    definicion: "CADENA BARBADA / CUBANA (curb / Cuban link chain): interlocking oval links that have been twisted, flattened and diamond-cut on the surfaces so they lay completely flat against the skin."
  },
  {
    id: "cadena_figaro",
    termino: "cadena Figaro",
    patrones: [/\bcadenas?\s+figaro\b/i, /\beslabon(?:es)?\s+figaro\b/i],
    definicion: "CADENA FIGARO (Figaro chain): rhythmic sequence alternating 3 small circular links followed by 1 elongated oval link, all diamond-cut and laying flat."
  },
  {
    id: "cadena_veneciana",
    termino: "cadena veneciana",
    patrones: [/\bcadenas?\s+veneciana\b/i, /\beslabon(?:es)?\s+veneciano\b/i, /\bbox\s+chain\b/i],
    definicion: "CADENA VENECIANA (Venetian box chain): geometric chain formed of tightly interlocking square box-like links, creating a clean four-sided geometric column."
  },
  {
    id: "cadena_serpiente",
    termino: "cadena serpiente",
    patrones: [/\bcadenas?\s+serpiente\b/i, /\bcola\s+de\s+raton\b/i, /\bsnake\s+chain\b/i],
    definicion: "CADENA SERPIENTE (snake chain): smooth, flexible, solid-looking metal cord made of tightly compressed micro-rings or curved bands with an unbroken, sleek surface. NOT a biological snake."
  },
  {
    id: "cadena_espiga",
    termino: "cadena de espiga",
    patrones: [/\bcadenas?\s+(?:de\s+)?espiga\b/i, /\bspiga\s+chain\b/i, /\bwheat\s+chain\b/i],
    definicion: "CADENA DE ESPIGA (wheat / spiga chain): braided chain composed of teardrop-shaped links intertwined in a four-strand symmetrical V-shaped wheat stalk pattern."
  },
  {
    id: "cadena_bolas",
    termino: "cadena de bolas",
    patrones: [/\bcadenas?\s+(?:de\s+)?bolas\b/i, /\bball\s+chain\b/i],
    definicion: "CADENA DE BOLAS (ball chain): series of seamless spherical metal beads joined by short internal connector wire segments."
  },

  // ── TEXTURAS Y ACABADOS DE SUPERFICIE ───────────────────
  {
    id: "pulido_espejo",
    termino: "pulido espejo",
    patrones: [/\bpulido\s+espejo\b/i, /\balto\s+brillo\b/i, /\bmirror\s+polish\b/i, /\bhigh\s+polish\b/i],
    definicion: "PULIDO ESPEJO (high mirror polish): ultra-smooth, distortion-free reflective surface with intense specular highlights and crisp studio reflections."
  },
  {
    id: "satinado",
    termino: "satinado / cepillado",
    patrones: [/\bsatinad[oas]{1,2}\b/i, /\bcepillad[oas]{1,2}\b/i, /\bacabados?\s+satinad[oas]{1,2}\b/i, /\bbrushed\s+finish\b/i],
    definicion: "SATINADO / CEPILLADO (brushed satin finish): fine, uniform microscopic linear brush strokes along the metal surface, creating a soft, diffuse luster with low glare."
  },
  {
    id: "mateado",
    termino: "mateado",
    patrones: [/\bmatead[oas]{1,2}\b/i, /\bacabados?\s+mate\b/i, /\bmetales?\s+mate\b/i, /\bmatte\s+finish\b/i],
    definicion: "MATEADO (velvety matte finish): uniform non-reflective textured surface with a soft, warm, diffused metal tone completely free of glossy glare."
  },
  {
    id: "martele",
    termino: "martelé / martilleado",
    patrones: [/\bmartele[s]?\b/i, /\bmartillead[oas]{1,2}\b/i, /\bfacetad[oas]{1,2}\s+a\s+martillo\b/i, /\bhammered\b/i],
    definicion: "MARTELÉ (hand-hammered finish): organic pattern of shallow, overlapping circular indentations faceted into the metal, catching light from multiple angles."
  },
  {
    id: "granallado",
    termino: "granallado / arenado",
    patrones: [/\bgranallad[oas]{1,2}\b/i, /\barenad[oas]{1,2}\b/i, /\bchorro\s+de\s+arena\b/i, /\bsandblasted\b/i, /\bbead[\s-]blasted\b/i],
    definicion: "GRANALLADO / ARENADO (sandblasted / bead-blasted): microscopic stippled, frosted texture giving an even, crystalline sparkle across the metal plane."
  },
  {
    id: "florentino",
    termino: "acabado florentino",
    patrones: [/\bflorentin[oas]{1,2}\b/i, /\bgrabados?\s+florentin[oas]{1,2}\b/i, /\bflorentine\s+finish\b/i],
    definicion: "ACABADO FLORENTINO (Florentine finish): exquisite fine cross-hatched grid of hand-engraved parallel microscopic grooves creating a shimmering silk-fabric texture."
  },
  {
    id: "filigrana",
    termino: "filigrana",
    patrones: [/\bfiligranas?\b/i, /\bcalados?\s+filigranad[oas]{1,2}\b/i, /\bfiligree\b/i],
    definicion: "FILIGRANA (openwork filigree): delicate, lace-like arabesques and curled wires soldered into intricate openwork patterns, light and airy."
  },
  {
    id: "envejecido",
    termino: "acabado envejecido / oxidado",
    patrones: [/\benvejecid[oas]{1,2}\b/i, /\boxidad[oas]{1,2}\b/i, /\bpatinas?\b/i, /\bantiqued\b/i],
    definicion: "ACABADO ENVEJECIDO (antiqued / oxidized finish): dark chemical patina settled deep into recessed engravings and textures, contrasting with polished raised highlights."
  },
  {
    id: "rodinado",
    termino: "rodinado",
    patrones: [/\brodinad[oas]{1,2}\b/i, /\bba[nñ]os?\s+de\s+rodio\b/i, /\brhodium\s+plated\b/i],
    definicion: "RODINADO (rhodium plated): electric white, cold metallic luster of pure rhodium enhancing the brilliance and crisp reflections of white gold or silver."
  },

  // ── MOTIVOS TRADICIONALES ADICIONALES ────────────────────
  {
    id: "monograma",
    termino: "monograma",
    patrones: [/\bmonogramas?\b/i, /\bletras\s+entrelazadas\b/i, /\bmonogram\b/i],
    definicion: "MONOGRAMA (monogram): two or more letters elegantly intertwined in an ornate Victorian style, overlapping to form a single decorative emblem. The letters weave through each other."
  },
  {
    id: "cuajo",
    termino: "cuajo",
    patrones: [/\bcuajos?\b/i],
    definicion: "CUAJO: a round, richly engraved decorative element with detailed relief work, typical of traditional Spanish goldsmithing."
  },
  {
    id: "chapa",
    termino: "chapa",
    patrones: [/\bchapas?\b/i, /\bplacas?\s+lisas?\b/i],
    definicion: "CHAPA (metal plate): a flat thin sheet of metal forming the base or face of the piece."
  },
  {
    id: "cordon",
    termino: "cordón",
    patrones: [/\bcordon(?:es)?\b/i],
    definicion: "CORDÓN (cord chain): a rope-style chain, twisted to look like a cord."
  },
  {
    id: "eslabon",
    termino: "eslabón",
    patrones: [/\beslabon(?:es)?\b/i],
    definicion: "ESLABÓN (chain link): individual loop of a chain."
  }
];

// Mapeo plano para compatibilidad
const GLOSARIO: Record<string, string> = Object.fromEntries(
  GLOSARIO_TERMINOS.map(item => [item.termino, item.definicion])
);

function detectImageMimeType(buf: Uint8Array, filePath?: string, headerType?: string | null): string {
  if (headerType && headerType.startsWith("image/") && !headerType.includes("octet-stream")) {
    return headerType.split(";")[0].trim();
  }
  if (buf.length >= 4) {
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  }
  const ext = filePath?.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function detectarTerminos(...textos: (string | null | undefined)[]): string {
  const textoCompleto = normalizarTextoParaGlosario(textos.filter(Boolean).join(" "));
  const definiciones: string[] = [];
  const idsVistos = new Set<string>();

  for (const item of GLOSARIO_TERMINOS) {
    if (idsVistos.has(item.id)) continue;
    for (const patron of item.patrones) {
      if (patron.test(textoCompleto)) {
        definiciones.push(item.definicion);
        idsVistos.add(item.id);
        break;
      }
    }
  }

  if (definiciones.length === 0) return "";
  return `\n\nJEWELRY TERMINOLOGY & STRUCTURAL SPECIFICATIONS (the client used professional jewelry workshop terms — follow these definitions strictly with zero deviations):\n${definiciones.map(d => "- " + d).join("\n")}`;
}

function detectarRestriccionesEspecificas(...textos: (string | null | undefined)[]): string {
  const textoCompleto = textos.filter(Boolean).join(" ").toLowerCase();
  const alertas: string[] = [];

  // Buscar dígitos
  const digitos = textoCompleto.match(/\b\d+\b/g);
  if (digitos) {
    digitos.forEach(num => {
      const regexContexto = new RegExp(`\\b${num}\\s+\\w+`, "gi");
      const matches = textoCompleto.match(regexContexto);
      if (matches) {
        matches.forEach(m => alertas.push(`Exact count constraint: "${m}" (ensure EXACTLY ${num} of these elements are rendered)`));
      } else {
        alertas.push(`Exact numerical quantity requested: "${num}" (must be strictly respected)`);
      }
    });
  }

  // Buscar números escritos en español
  const numerosEscritos = [
    { palabras: ["cero"], valor: 0 },
    { palabras: ["uno", "una"], valor: 1 },
    { palabras: ["dos"], valor: 2 },
    { palabras: ["tres"], valor: 3 },
    { palabras: ["cuatro"], valor: 4 },
    { palabras: ["cinco"], valor: 5 },
    { palabras: ["seis"], valor: 6 },
    { palabras: ["siete"], valor: 7 },
    { palabras: ["ocho"], valor: 8 },
    { palabras: ["nueve"], valor: 9 },
    { palabras: ["diez"], valor: 10 },
    { palabras: ["once"], valor: 11 },
    { palabras: ["doce"], valor: 12 },
    { palabras: ["trece"], valor: 13 },
    { palabras: ["catorce"], valor: 14 },
    { palabras: ["quince"], valor: 15 }
  ];

  numerosEscritos.forEach(({ palabras, valor }) => {
    palabras.forEach(palabra => {
      const regex = new RegExp(`\\b${palabra}\\b`, "i");
      if (regex.test(textoCompleto)) {
        const regexContexto = new RegExp(`\\b${palabra}\\s+(\\w+)`, "i");
        const match = regexContexto.exec(textoCompleto);
        if (match && match[1]) {
          alertas.push(`Exact count constraint: "${palabra} ${match[1]}" (ensure EXACTLY ${valor} of these elements are rendered)`);
        } else {
          alertas.push(`Exact count constraint: "${palabra}" (ensure exactly ${valor} of these elements are rendered)`);
        }
      }
    });
  });

  // Buscar palabras de geometría/forma y acabados en español
  const terminosGeometria = [
    { terminos: ["margarita"], desc: "Shape / Flower: Daisy flower shape" },
    { terminos: ["pétalo", "petalo", "pétalos", "petalos"], desc: "Flower element: Petals count and shape" },
    { terminos: ["hoja", "hojas"], desc: "Foliage: Leaf shape and count" },
    { terminos: ["redondo", "redonda", "redondeado", "redondeada", "redondear", "redondeo"], desc: "Geometric style: Rounded, soft, circular outline and edges (NOT sharp, NOT square, NOT angular)" },
    { terminos: ["elíptico", "eliptico", "elíptica", "eliptica", "elipse"], desc: "Geometric style: Elliptical, oval, elongated curved outline and edges (ellipse shape)" },
    { terminos: ["cuadrado", "cuadrada", "cuadrangular"], desc: "Geometric style: Square, rectangular, sharp 90-degree corners, flat straight sides (unmistakably square/rectangular)" },
    { terminos: ["triangular", "triángulo", "triangulo"], desc: "Geometric style: Triangular shape, three clear points and straight edges (unmistakably triangular)" },
    { terminos: ["pentagonal", "pentágono", "pentagono"], desc: "Geometric style: Pentagonal (5-sided polygon shape). The setting/bezel, head, or stone must feature an unmistakable 5-sided pentagon geometry. RETAIN any center gemstone in the piece, securely set inside this pentagonal setting/bezel." },
    { terminos: ["hexagonal", "hexágono", "hexagono"], desc: "Geometric style: Hexagonal (6-sided polygon shape). RETAIN any center gemstone within the hexagonal setting." },
    { terminos: ["octogonal", "octágono", "octagono"], desc: "Geometric style: Octagonal (8-sided polygon shape). RETAIN any center gemstone within the octagonal setting." },
    { terminos: ["romboidal", "rombo"], desc: "Geometric style: Rhombus / diamond shape" },
    { terminos: ["plano", "plana"], desc: "Geometric style: Flat, level surface and profile" },
    { terminos: ["convexo", "convexa"], desc: "Geometric style: Convex, domed profile" },
    { terminos: ["cóncavo", "concavo", "cóncava", "concava"], desc: "Geometric style: Concave, hollowed profile" },
    { terminos: ["puntiagudo", "puntiaguda", "punta"], desc: "Geometric style: Pointed, sharp tips and ends" }
  ];

  terminosGeometria.forEach(({ terminos, desc }) => {
    const detectado = terminos.some(t => {
      const regex = new RegExp(`\\b${t}`, "i");
      return regex.test(textoCompleto);
    });
    if (detectado) {
      alertas.push(`Geometric / Stylistic constraint: "${terminos[0]}" -> ${desc}`);
    }
  });

  // Detectar cambios en tallas y cortes de gemas / piedras (ej. "piedra redonda", "talla brillante", etc.)
  const cortesGema = [
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:redonda|redondo|brillante)|\btalla\s+brillante\b|\bbrillante\s+redondo\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Round brilliant cut stone (talla redonda / brillante). The primary gemstone must be transformed into a perfectly circular, faceted round brilliant cut diamond/gemstone with circular bezel/prongs holding it." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:ovalada|ovalado|oval)|\btalla\s+oval\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Oval cut stone (talla oval). The primary gemstone must be shaped as an elegant oval cut stone." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:esmeralda|emerald)|\btalla\s+esmeralda\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Emerald cut stone (rectangular stepped cut with clipped corners)." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:cuadrada|cuadrado|princesa)|\btalla\s+princesa\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Princess / square cut stone (sharp 90-degree square facet cut)." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:pentagonal)|\b(?:corte|talla|forma)\s+pentagonal\b/i, desc: "GEMSTONE CUT / SETTING OVERRIDE: Pentagonal geometry. Sculpt a 5-sided pentagonal head/bezel holding the gemstone securely in the center." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:pera|lagrima|lágrima)|\btalla\s+pera\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Pear / teardrop cut stone." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:marquesa|marquise)|\btalla\s+marquise\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Marquise cut stone (pointed oval / navette shape)." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:coj[ií]n|cushion)|\btalla\s+coj[ií]n\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Cushion cut stone (pillow-shaped rounded rectangle/square)." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:baguette)|\btalla\s+baguette\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Baguette cut stone." },
    { regex: /\b(?:piedra|talla|corte|gema|diamante)\s+(?:coraz[oó]n|heart)|\btalla\s+coraz[oó]n\b/i, desc: "GEMSTONE CUT / SHAPE OVERRIDE: Heart cut stone." },
  ];

  cortesGema.forEach(({ regex, desc }) => {
    if (regex.test(textoCompleto)) {
      alertas.push(desc);
    }
  });

  // Detectar solicitudes explícitas de restauración / quejas de elementos eliminados
  if (/\b(?:has quitado|quitaste|falta|faltan|no tiene|donde est[aá]|vuelve a poner|pon de nuevo|pon la|pon el|restaura|devuelve)\s+(?:la|el|las|los)?\s*(?:esmeralda|rub[ií]|zafiro|diamante|brillante|piedra|gema|joya)\b/i.test(textoCompleto)) {
    alertas.push("CRITICAL RESTORATION CONSTRAINT: The client explicitly states that a gemstone/jewel was removed or is missing. You MUST RESTORE AND ADD the gemstone into the center setting of the piece, with high brilliance, transparent light refraction, vivid color, and proper prongs/bezel!");
  }

  if (alertas.length === 0) return "";

  // Filtrar duplicados
  const alertasUnicas = [...new Set(alertas)];

  return `\n\n⚠️ EXTRA PRIORITY GEOMETRIC & NUMERICAL CONSTRAINTS (the client explicitly requested these details - you MUST execute them with absolute precision):\n${alertasUnicas.map(a => "- " + a).join("\n")}`;
}

interface GemaInfo {
  tieneGema: boolean;
  desc: string;
  nombre: string | null;
  esRemover: boolean;
  esRestaurar: boolean;
}

function detectarGema(gemaInput?: string, ...textos: (string | null | undefined)[]): GemaInfo {
  const textoCompleto = textos.filter(Boolean).join(" ").toLowerCase();

  // 1. Detección explícita de eliminación de gema
  const esRemover = /\b(?:sin\s+(?:gema|piedra|diamante|joya)|quitar\s+(?:la\s+)?(?:gema|piedra|esmeralda|diamante|joya)|eliminar\s+(?:la\s+)?(?:gema|piedra|esmeralda|diamante|joya)|no\s+quiero\s+piedra|solo\s+metal|solamente\s+metal)\b/i.test(textoCompleto);
  if (esRemover) {
    return { tieneGema: false, desc: "no gemstone — clean polished metal only (the user explicitly requested to remove the stone)", nombre: "sin_gema", esRemover: true, esRestaurar: false };
  }

  // 2. Detección de queja o petición de restauración
  const esRestaurar = /\b(?:has quitado|quitaste|falta|faltan|no tiene|donde est[aá]|vuelve a poner|pon de nuevo|pon la|pon el|restaura|devuelve)\s+(?:la|el)?\s*(?:esmeralda|rub[ií]|zafiro|diamante|brillante|piedra|gema|joya)\b/i.test(textoCompleto);

  // 3. Detección de tipos específicos de piedras
  const source = ((gemaInput || "") + " " + textoCompleto).toLowerCase();

  if (/\besmeralda\b|\bemerald\b/i.test(source)) {
    return { tieneGema: true, desc: "natural emerald (intense vivid green natural emerald gemstone with realistic light refraction, transparency, and brilliant facets)", nombre: "esmeralda", esRemover: false, esRestaurar };
  }
  if (/\brub[ií]\b|\bruby\b/i.test(source)) {
    return { tieneGema: true, desc: "natural ruby (deep vivid red natural ruby gemstone with realistic light refraction, transparency, and brilliant facets)", nombre: "rubi", esRemover: false, esRestaurar };
  }
  if (/\bzafiro\b|\bsapphire\b/i.test(source)) {
    return { tieneGema: true, desc: "natural sapphire (deep royal blue natural sapphire gemstone with realistic light refraction, transparency, and brilliant facets)", nombre: "zafiro", esRemover: false, esRestaurar };
  }
  if (/\bdiamante\b|\bbrillante\b|\bdiamond\b/i.test(source)) {
    return { tieneGema: true, desc: "natural diamond (sparkling transparent white natural brilliant cut diamond with exceptional fire, brilliance, and light caustics)", nombre: "diamante", esRemover: false, esRestaurar };
  }
  if (/\bperla\b|\bpearl\b/i.test(source)) {
    return { tieneGema: true, desc: "natural lustrous pearl (smooth iridescent surface, natural luster)", nombre: "perla", esRemover: false, esRestaurar };
  }
  if (/\bamatista\b|\bamethyst\b/i.test(source)) {
    return { tieneGema: true, desc: "natural amethyst (vivid purple natural faceted gemstone with transparency and light caustics)", nombre: "amatista", esRemover: false, esRestaurar };
  }
  if (/\btopacio\b|\btopaz\b/i.test(source)) {
    return { tieneGema: true, desc: "natural topaz (fine natural faceted gemstone with realistic transparency)", nombre: "topacio", esRemover: false, esRestaurar };
  }
  if (/\bcirco(?:nita|nio)\b|\bcircon\b|\bzirconia\b/i.test(source)) {
    return { tieneGema: true, desc: "cubic zirconia (sparkling transparent faceted synthetic gemstone)", nombre: "circonita", esRemover: false, esRestaurar };
  }
  if (/\b(?:piedra|gema|joya|gemstone|stone)\b/i.test(source)) {
    return { tieneGema: true, desc: "fine natural faceted precious gemstone (preserve the gemstone color, cut and material from the reference image)", nombre: "gema", esRemover: false, esRestaurar };
  }

  // 4. Fallback a gemaInput
  if (gemaInput && gemaInput !== "sin_gema") {
    return { tieneGema: true, desc: `${gemaInput} — realistic facets, transparency and light refraction`, nombre: gemaInput, esRemover: false, esRestaurar: false };
  }
  if (gemaInput === "sin_gema") {
    return { tieneGema: false, desc: "no gemstone — clean polished metal only", nombre: "sin_gema", esRemover: true, esRestaurar: false };
  }

  return { tieneGema: false, desc: "", nombre: null, esRemover: false, esRestaurar: false };
}

// ═══ MAPS ═══════════════════════════════════════════════════
const CATEGORY_MAP: Record<string, string> = {
  anillo:     "ring (circular band worn on finger)",
  colgante:   "pendant (hanging from a chain, worn on chest)",
  pendientes: "earrings (worn on earlobes, always render as a PAIR)",
  pulsera:    "bracelet (worn around wrist)",
  gemelos:    "cufflinks (formal men's shirt accessory, always render as a PAIR)",
  medallas:   "medallion pendant (flat disc-shaped, religious or commemorative)",
};

const BODY_PART_MAP: Record<string, string> = {
  anillo:     "naturally showing the ring worn on a person's finger, elegant hand placement (e.g. resting on clothing), showing realistic scale and fit, not too close",
  colgante:   "close-up portrait shot showing the pendant worn around a person's neck/chest, hanging naturally, showing realistic scale and fit",
  pendientes: "side-profile or three-quarter profile portrait shot of a person's head and neck, with the head turned to the side so that the ear and the earring face the camera directly, showing realistic scale and fit (do NOT show the model facing forward; the ear must face the camera directly)",
  pulsera:    "naturally showing the bracelet worn around a person's wrist, showing realistic scale and fit",
  gemelos:    "showing the cufflink worn on a formal shirt cuff, showing realistic scale and fit",
  medallas:   "close-up portrait shot showing the medallion pendant worn around a person's neck/chest, hanging naturally, showing realistic scale and fit",
};

const CATEGORY_LABELS: Record<string, string> = {
  anillo: "Anillo", colgante: "Colgante", pendientes: "Pendientes",
  pulsera: "Pulsera", gemelos: "Gemelos", medallas: "Medalla",
  sin_detalle: "Sin detalle (según foto)",
};

const MATERIAL_MAP: Record<string, string> = {
  oro_amarillo: "18k yellow gold — warm golden color, mirror-polished",
  oro_blanco:   "18k white gold rhodium plated — cool silver-white, mirror-polished",
  oro_rosa:     "18k rose gold — warm pinkish-gold, mirror-polished",
  platino:      "platinum 950 — naturally white, dense, prestigious",
  plata:        "sterling silver 925 — bright silver, polished",
};

const MATERIAL_LABELS: Record<string, string> = {
  oro_amarillo: "Oro Amarillo 18k", oro_blanco: "Oro Blanco 18k",
  oro_rosa: "Oro Rosa 18k", platino: "Platino 950", plata: "Plata 925",
  sin_detalle: "Sin detalle (según foto)",
};

const STYLE_MAP: Record<string, string> = {
  moderno:    "modern minimalist — smooth surfaces, clean geometric lines, no ornamentation, simple and elegant",
  clasico:    "classic — traditional proportions, subtle engravings or fine details, timeless elegance",
  naturaleza: "nature-inspired — organic forms, subtle leaf or floral motifs, flowing lines",
};

const PROFILE_MAP: Record<string, string> = {
  senora:    "adult woman",
  caballero: "adult man",
  cadete:    "teenager",
  nino:      "child (very small scale)",
};

// MODELO CONFIRMADO FUNCIONAL
const GEMINI_MODEL = "gemini-3.1-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Env vars (fallbacks para ambas convenciones de nombres) ──
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("URL") || "";
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_KEY") || "";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
    const PROPIETARIO_EMAIL = Deno.env.get("PROPIETARIO_EMAIL") || "rometjoyeria@gmail.com";

    if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
      throw new Error("Missing required environment variables (SUPABASE_URL/URL, SUPABASE_SERVICE_ROLE_KEY/SERVICE_KEY, GEMINI_API_KEY)");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ── Auth check ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const userToken = authHeader?.replace("Bearer ", "");
    if (!userToken) throw new Error("No session token provided");
    const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
    if (authError || !user) throw new Error("Unauthorized");

    // ── Parse body FIRST ──────────────────────────────────────────
    const body = await req.json();
    const {
      nombre, telefono, email, categoria_producto, material,
      perfil_usuario, gema_principal, estilo, presupuesto,
      peso_estimado, talla_medida, sugerencias,
      imagen_subida_url,
      imagen_subida_url2,
      imagen_referencia_url,
      imagen_original_url,
      cambios_solicitados,
      es_redisenio_gratuito,
      numero_redisenio,
    } = body;

    const esRetoque     = !!imagen_referencia_url;
    const esImagenSubida = !!imagen_subida_url || !!imagen_subida_url2;
    const imagenParaGemini = imagen_referencia_url || imagen_subida_url || imagen_subida_url2 || null;

    // Los primeros 5 rediseños son gratuitos y NO deben bloquearse si los créditos están en 0
    const esRedisenioGratis = esRetoque && es_redisenio_gratuito !== false;

    // ── Credit check (No bloquea si es ilimitado o si es un rediseño gratuito) ──
    const isUnlimited = user.user_metadata?.is_unlimited === true || user.user_metadata?.plan === "profesionales_plus";
    const credits = user.user_metadata?.credits ?? 0;
    if (!isUnlimited && !esRedisenioGratis && credits <= 0) {
      return new Response(JSON.stringify({ error: "Sin créditos" }), { status: 402, headers: corsHeaders });
    }

    const marca_temporal = new Date().toISOString();

    // ── Build descriptions ───────────────────────────────────────
    const tieneCategoria = !!(
      categoria_producto &&
      categoria_producto !== "sin_detalle" &&
      categoria_producto !== "sin_especificar" &&
      categoria_producto !== "auto" &&
      categoria_producto !== "ninguno"
    );
    const tieneMaterial = !!(
      material &&
      material !== "sin_detalle" &&
      material !== "sin_especificar" &&
      material !== "auto" &&
      material !== "ninguno"
    );

    const categoriaDesc = tieneCategoria ? (CATEGORY_MAP[categoria_producto] || categoria_producto) : null;
    const materialDesc  = tieneMaterial  ? (MATERIAL_MAP[material] || material) : null;
    const estiloDesc    = STYLE_MAP[estilo]                || estilo             || "classic";
    const perfilDesc    = PROFILE_MAP[perfil_usuario]      || perfil_usuario      || "adult";
    const bodyPartDesc  = tieneCategoria
      ? (BODY_PART_MAP[categoria_producto] || "worn naturally by a person")
      : "worn naturally by a model according to the jewelry piece type shown in the image (e.g. on finger if ring, on neck/chest if pendant/medal, on ear if earring, on wrist if bracelet)";

    const gemaInfo = detectarGema(gema_principal, sugerencias, cambios_solicitados);

    let gemstoneLine: string;
    if (gemaInfo.esRemover) {
      gemstoneLine = "- Gemstone: NO GEMSTONE — clean polished metal only (user explicitly requested to remove the stone)";
    } else if (gemaInfo.tieneGema) {
      gemstoneLine = `- Gemstone: ${gemaInfo.desc}`;
    } else if (esRetoque) {
      gemstoneLine = "- Gemstone: PRESERVE GEMSTONE FROM CURRENT DESIGN — If the attached design features a gemstone (such as an emerald, diamond, ruby, sapphire, or center stone), YOU MUST PRESERVE THAT GEMSTONE, maintaining its color, presence, and brilliance in the setting. Do NOT remove it unless explicitly asked.";
    } else if (esImagenSubida) {
      gemstoneLine = "- Gemstone: PRESERVE GEMSTONE FROM UPLOADED REFERENCE — If the uploaded photo/sketch features a gemstone, reproduce that exact gemstone (matching color, cut and setting). If plain metal, render clean polished metal.";
    } else {
      gemstoneLine = "- Gemstone: no gemstone — clean polished metal only";
    }

    const glosarioInyectado = detectarTerminos(sugerencias, cambios_solicitados);
    const restriccionesGeometriaYNumeros = detectarRestriccionesEspecificas(sugerencias, cambios_solicitados);

    const specLines: string[] = [];
    if (tieneCategoria) {
      if (esImagenSubida) {
        specLines.push(`- Target Category: ${categoriaDesc} (The client explicitly selected this category. If the reference image shows a different piece or motif, transform/adapt that motif into this specific jewelry category: ${categoriaDesc})`);
      } else {
        specLines.push(`- Type: ${categoriaDesc}`);
      }
    }
    if (tieneMaterial) {
      specLines.push(`- Metal: ${materialDesc}`);
    }
    specLines.push(gemstoneLine);
    if (estilo && estilo !== "sin_detalle" && estilo !== "sin_especificar") {
      specLines.push(`- Style: ${estiloDesc}`);
    }
    if (perfil_usuario && perfil_usuario !== "sin_detalle" && perfil_usuario !== "sin_especificar") {
      specLines.push(`- Target wearer: ${perfilDesc}`);
    }
    if (sugerencias) {
      specLines.push(`- Design notes: ${sugerencias}`);
    }

    const especificaciones = specLines.length > 0
      ? `JEWELRY SPECIFICATIONS:\n${specLines.join("\n")}`
      : "";

    const reglasEstilo = `CRITICAL STYLE RULES — follow strictly:
- The piece MUST look like a real, commercially available jewelry store product
- SIMPLE and CLEAN — no excessive decoration, no fantasy elements
- Realistic, wearable proportions
- STRICT NUMERICAL AND GEOMETRIC ACCURACY: You must strictly adhere to the number of elements (such as petals, leaves, gemstones, links) specified. If the user asks for 10 petals, you must render exactly 10 petals, not 12. If a specific geometric finish (e.g. square, triangular, elliptical, rounded, pentagonal) or gemstone cut is requested, prioritize it and make it highly defined and clearly visible in the shape of the jewelry. Do not approximate shapes or quantities.
- DO NOT add faces, animals, crowns, wings, dragons, snakes, skulls or fantasy motifs unless explicitly requested
- DO NOT invent decorative elements that were not asked for
- Understated and elegant, never baroque or churrigueresque`;

    const reglasVistas = `FOUR-VIEW COMPOSITE IMAGE — CRITICALLY IMPORTANT:
- Generate ONE wide horizontal image divided into FOUR equal vertical panels side by side
- 1st panel (left): FRONT view (piece alone, facing viewer directly, upright, pure white background)
- 2nd panel (center-left): BACK view (piece alone, rotated 180°, showing reverse side, pure white background)
- 3rd panel (center-right): SIDE/PROFILE view (piece alone, rotated 90°, showing depth and thickness, pure white background)
- 4th panel (right): ON-MODEL view (showing the exact same piece being worn by a generic professional model, ${bodyPartDesc})
- ⚠️ ALL FOUR PANELS MUST SHOW THE EXACT SAME SINGLE PIECE — only the view and context differ
- The piece MUST be IDENTICAL in all panels: same shape, same size, same gemstones, same proportions, same decorative details
- This is ONE object photographed from different angles and in context — NOT different objects
- Do NOT add, remove or change any element of the jewelry between panels
- Small labels at the bottom of each panel: FRONT | BACK | SIDE | ON MODEL`;

    const reglasEncuadre = `FRAMING & COMPOSITION (STRICTLY REQUIRED TO PREVENT CROP/CUTOFF):
- In the first three panels (FRONT, BACK, SIDE), the entire jewelry piece MUST be 100% FULLY VISIBLE and perfectly centered.
- ⚠️ NEVER crop, cut off, chop, or truncate any edge or part of the jewelry piece in the first three panels.
- There MUST be a generous, comfortable clear empty white margin (at least 20% to 25% padding/negative space) all around the jewelry piece inside the first three panels.
- For the fourth panel (ON-MODEL), the composition must be tailored to show the jewelry with absolute clarity:
  1. For EARRINGS (pendientes): The model's head MUST be turned in a side profile or three-quarter profile so the ear and earring face the camera directly. The camera should zoom in elegantly to frame the ear, jawline, and neck (do NOT show the model facing forward, as this hides the earring, and do NOT show the entire face and torso, which makes the earring look like a tiny dot).
  2. For RINGS (anillo) / BRACELETS (pulsera): Show a close-up of the hand/wrist resting naturally (e.g. on a jacket lapel or fabric), with the jewelry clearly visible.
  3. For PENDANTS / MEDALLIONS (colgante/medallas): Show a close-up portrait of the neck and upper chest area where the necklace sits.
  4. Always avoid wide-angle shots that make the jewelry look tiny or hard to see. Keep a shallow depth of field with a soft out-of-focus background.
- No part, edge, prong, chain link, or detail of the jewelry should ever touch or go beyond the boundaries of any panel.`;

    const tieneGemaParaRender = gemaInfo.tieneGema || (esRetoque && !gemaInfo.esRemover) || (esImagenSubida && !gemaInfo.esRemover);

    const reglasRender = `RENDERING QUALITY:
- Panels 1, 2, and 3: Pure white seamless studio background with professional softbox lighting
- Panel 4: Natural realistic model portrait background (soft-focus, warm natural lighting, realistic skin textures)
- Mirror-polished metal with realistic reflections and highlights
- ${tieneGemaParaRender ? "Gemstones with realistic transparency, light caustics, and luxury brilliance. Clean polished metal surfaces." : "Clean polished metal surface"}
- Ultra-sharp macro photography quality
- No watermarks, no text overlays (EXCEPT the four panel labels FRONT/BACK/SIDE/ON MODEL at the bottom)`;

    const hasOriginalImage = !!(imagen_original_url && imagen_original_url !== imagen_referencia_url);

    // ── Build prompt (3 modos) ───────────────────────────────────
    let prompt: string;

    if (esRetoque) {
      // MODO 2/4: Retoque de imagen existente
      prompt = `You are a professional fine jewelry designer performing a PRECISE RETOUCH on an existing design.

The attached image shows the CURRENT design.
${hasOriginalImage ? "A second attached image shows the ORIGINAL client reference piece for comparison.\n" : ""}
⚠️ OVERRIDE PRIORITY FOR REQUESTED CHANGES:
If the requested changes modify any specific attribute (such as changing the stone shape/cut, adding or removing a stone, altering the metal color, changing engravings, changing dimensions or details), THAT MODIFICATION OVERRIDES THE ORIGINAL IMAGE FOR THAT SPECIFIC ATTRIBUTE.
For example, if the original design has an emerald-cut (rectangular) stone and the requested change is "Hacerlo con la piedra redonda" (make it with a round stone), you MUST change the gemstone to a round brilliant cut stone, adapting the setting/prongs to securely hold the round stone, while keeping the rest of the band, metal, and style identical.

⚠️ CRITICAL RETOUCH RULES FOR GEMSTONES & SHAPES:
1. NEVER REMOVE GEMSTONES UNLESS EXPLICITLY COMMANDED: If the reference design features a gemstone (such as an emerald, diamond, ruby, sapphire, etc.), YOU MUST KEEP THAT GEMSTONE in the new design. Never eliminate a stone unless the client explicitly says "quitar la piedra" or "sin piedra".
2. GEOMETRIC SHAPE MODIFICATIONS (e.g. "hazlo pentagonal", "hazlo cuadrado", "hazlo redondo"): When the client asks for a geometric modification like "hazlo pentagonal la joya", transform the setting/bezel, head, and/or stone to that pentagonal geometry, but the piece MUST RETAIN ITS CENTER GEMSTONE securely set in the new pentagonal setting!
3. RESTORING MISSING ELEMENTS: If the client mentions that an element was removed or asks to restore it (e.g. "has quitado la esmeralda", "vuelve a poner la joya", "falta la piedra", "pon la joya", "pon la esmeralda"):
   - YOU MUST IMMEDIATELY RESTORE AND ADD THAT GEMSTONE into the center setting of the piece!
   - Sculpt a proper fine-jewelry setting (bezel or prongs) into the top/center of the piece and securely mount the requested gemstone (${gemaInfo.desc || "emerald / precious gemstone"}) with vivid color, brilliant faceting, transparency, and light caustics!
   - DO NOT keep it as plain metal when the client asks for the stone back!

Modify ONLY what is specified in the requested changes below, keeping EVERYTHING ELSE exactly identical. This is a retouch — NOT a completely new redesign from scratch. Do not reinvent the piece, do not change elements that the requested change does not explicitly touch.

${especificaciones}

⚠️ REQUESTED CHANGES — apply ONLY these specific modifications, keep all other features identical to the attached image:
"${cambios_solicitados || sugerencias}"
${glosarioInyectado}
${restriccionesGeometriaYNumeros}

${reglasEstilo}

${reglasVistas}

${reglasEncuadre}

${reglasRender}

CRITICAL: The result must be immediately recognizable as the SAME piece from the attached image, with ONLY the requested change applied with absolute precision. Preserve original band form, metal proportions, letters, and all unchanged details.`;

    } else if (esImagenSubida) {
      // MODO 3: El cliente sube una foto de referencia
      prompt = `You are a professional fine jewelry designer. The attached images are references uploaded by the client (a design they like, a sketch, or a portrait photo of a person/family member).

Study the references carefully and reproduce their key elements faithfully as a professional jewelry piece:
- EXACT 1-TO-1 PORTRAIT ENGRAVINGS: If any of the references show a person's face or portrait (e.g., a family member, child, or parent), the jewelry piece (especially if it is a medallion pendant, medal, coin, or cameo) MUST feature a masterfully sculpted, high-fidelity 3D bas-relief engraving of that exact person's face on the polished metal surface. Capturing their exact likeness, eye shape, nose shape, mouth structure, jawline, hair details, and facial expression is CRITICAL. The metallic bas-relief must look identical to the person in the photo, as if their exact face was directly printed or sculpted onto the gold/silver surface with perfect fidelity. Do NOT generalize, simplify, or stylize the face. It must be an exact, recognizable portrait of the specific individual shown in the reference photo.
- SKETCHES & DESIGNS: If any of the references show a sketch or drawing of a jewelry style, shape, or clasp, reproduce those design lines and proportions faithfully as a real, wearable piece of jewelry.
- GEMSTONES & EMBELLISHMENTS: If the uploaded reference features any gemstones (like an emerald, diamond, sapphire, etc.), reproduce them faithfully with identical colors, cuts, and proper fine jewelry settings.
- Combining references: If multiple images are attached (for example, a portrait photo of a relative AND a sketch or reference image of a medallion), combine them masterfully. The face from the portrait photo must be engraved onto the jewelry style shown in the other reference image.
${tieneCategoria ? "" : "- PIECE TYPE & METAL: Faithful reproduction of the uploaded image. Create the exact type of jewelry shown in the photo (e.g. if the photo is a ring, design a ring; if it is a bracelet, design a bracelet; if it is a pendant, design a pendant) and preserve its metal color and finish."}

${especificaciones}
${glosarioInyectado}
${restriccionesGeometriaYNumeros}

${reglasEstilo}

${reglasVistas}

${reglasEncuadre}

${reglasRender}`;

    } else {
      // MODO 1: Diseño desde cero
      prompt = `You are a professional fine jewelry designer. Generate a photorealistic jewelry piece based on the specifications below.

${especificaciones}
${glosarioInyectado}
${restriccionesGeometriaYNumeros}

${reglasEstilo}

${reglasVistas}

${reglasEncuadre}

${reglasRender}`;
    }

    // ── Load reference images if provided ────────────────────────
    const fetchImagePart = async (url: string) => {
      try {
        // First try direct fetch (proven reliable for public URLs)
        const imgRes = await fetch(url);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const base64 = encode(bytes);
          const mimeType = detectImageMimeType(bytes, url, imgRes.headers.get("content-type"));
          console.log("Reference image loaded from URL:", url, "mimeType:", mimeType, "bytes:", bytes.byteLength);
          return { inlineData: { mimeType, data: base64 } };
        } else {
          console.warn("Direct fetch image failed with status:", imgRes.status, url);
        }
      } catch (e) {
        console.warn("Could not fetch image directly, attempting storage fallback:", url, e);
      }

      // Storage download fallback if direct fetch failed
      try {
        const storageMatch = url.match(/\/storage\/v1\/object\/(?:public\/|authenticated\/)?([^\/]+)\/(.+)$/);
        if (storageMatch) {
          const bucket = storageMatch[1];
          const filePath = decodeURIComponent(storageMatch[2].split("?")[0]);
          const { data, error } = await supabase.storage.from(bucket).download(filePath);
          if (!error && data) {
            const buf = await data.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const base64 = encode(bytes);
            const mimeType = detectImageMimeType(bytes, filePath, data.type);
            console.log("Reference image downloaded from Storage fallback:", bucket, filePath, "mimeType:", mimeType, "bytes:", bytes.byteLength);
            return { inlineData: { mimeType, data: base64 } };
          } else {
            console.warn("Storage fallback download failed:", error?.message);
          }
        }
      } catch (err) {
        console.warn("Could not load reference image from storage fallback:", url, err);
      }

      return null;
    };

    // ── Call Gemini ──────────────────────────────────────────────
    const parts: any[] = [];

    if (imagen_referencia_url) {
      const p = await fetchImagePart(imagen_referencia_url);
      if (p) parts.push(p);
    }
    if (imagen_original_url && imagen_original_url !== imagen_referencia_url) {
      const p = await fetchImagePart(imagen_original_url);
      if (p) parts.push(p);
    }
    if (imagen_subida_url && imagen_subida_url !== imagen_referencia_url && imagen_subida_url !== imagen_original_url) {
      const p = await fetchImagePart(imagen_subida_url);
      if (p) parts.push(p);
    }
    if (imagen_subida_url2) {
      const p = await fetchImagePart(imagen_subida_url2);
      if (p) parts.push(p);
    }

    parts.push({ text: prompt });

    const modo = esRetoque ? "retoque" : esImagenSubida ? "imagen_subida" : "desde_cero";
    console.log(`v82 — mode: ${modo}, model: ${GEMINI_MODEL}, hasRefImage: ${!!imagenParaGemini}`);

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      console.error("Gemini error:", JSON.stringify(geminiData).substring(0, 600));
      throw new Error(`Gemini API error: ${geminiData?.error?.message || geminiRes.status}`);
    }

    const imagePart = geminiData.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart) {
      const candidate = geminiData.candidates?.[0];
      const textParts = candidate?.content?.parts?.filter((p: any) => p.text).map((p: any) => p.text).join(" ").trim();
      const finishReason = candidate?.finishReason || geminiData.promptFeedback?.blockReason;
      console.error("Gemini returned no image. FinishReason:", finishReason, "Text:", textParts, "Full candidates:", JSON.stringify(geminiData.candidates));
      throw new Error(`Gemini no generó imagen (${finishReason || "SIN_IMAGEN"})${textParts ? ": " + textParts.substring(0, 200) : ". Reintenta la solicitud."}`);
    }

    // ── Save image to Supabase Storage ───────────────────────────
    const fileName = `diseno_${Date.now()}_${modo}.png`;
    const imageBytes = Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0));
    const { error: storageError } = await supabase.storage
      .from("disenos")
      .upload(fileName, imageBytes, { contentType: "image/png", upsert: false });

    if (storageError) {
      console.error("Storage error:", storageError.message);
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    const { data: urlData } = supabase.storage.from("disenos").getPublicUrl(fileName);
    const imagenUrl = urlData.publicUrl;
    console.log("Image saved:", imagenUrl);

    // ── Insert into DB ───────────────────────────────────────────
    const insertPayload: any = {
      imagen_generada_url: imagenUrl,
      prompt_usado: prompt,
      marca_temporal,
    };
    const dbFields = ["nombre","telefono","email","categoria_producto","material",
      "perfil_usuario","gema_principal","estilo","sugerencias","talla_medida"];
    dbFields.forEach(f => { if (body[f] !== undefined) insertPayload[f] = body[f]; });
    if (body.presupuesto !== undefined) insertPayload.presupuesto = body.presupuesto ? String(body.presupuesto) : null;
    if (body.peso_estimado !== undefined) insertPayload.peso_estimado = body.peso_estimado ? String(body.peso_estimado) : null;
    if (imagen_subida_url) insertPayload.imagen_subida_url = imagen_subida_url;
    if (imagen_subida_url2) insertPayload.imagen_subida_url2 = imagen_subida_url2;
    if (imagen_referencia_url) insertPayload.imagen_subida_url = imagen_referencia_url;
    insertPayload.categoria_producto = tieneCategoria ? categoria_producto : "sin_detalle";
    insertPayload.material = tieneMaterial ? material : "sin_detalle";
    if (gemaInfo.nombre && (!insertPayload.gema_principal || insertPayload.gema_principal === "sin_gema")) {
      insertPayload.gema_principal = gemaInfo.nombre;
    }

    const { data: insertedData, error: dbError } = await supabase
      .from("solicitudes_disenos_romet")
      .insert(insertPayload)
      .select()
      .single();

    if (dbError) {
      console.error("DB Insert error:", JSON.stringify(dbError));
    } else {
      console.log("DB Insert OK, ID:", insertedData?.id);
    }

    // ── Send emails via Resend (se envía tanto en nuevas solicitudes como en retoques) ──
    if (email && RESEND_API_KEY) {
      const emailImageHtml = `
        <div style="text-align:center; margin:20px 0;">
          <img src="${imagenUrl}" style="max-width:100%; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.1);" alt="Diseño generado" />
          <p style="font-size:11px; color:#999; margin-top:6px; font-family:sans-serif;">Vista compuesta: Frontal · Trasera · Lateral · En Persona</p>
        </div>`;

      const resendHeaders = {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      };

      const catEmailLabel = tieneCategoria ? (CATEGORY_LABELS[categoria_producto] || categoria_producto) : "Sin detalle (según foto)";
      const matEmailLabel = tieneMaterial  ? (MATERIAL_LABELS[material] || material) : "Sin detalle (según foto)";
      const subjectCat = tieneCategoria ? (CATEGORY_LABELS[categoria_producto] || categoria_producto) : "Joya personalizada";

      const ownerSubject = esRetoque
        ? `🔄 Ajuste de diseño: ${subjectCat} — ${nombre || "Cliente"}`
        : `⚡ Nueva solicitud: ${subjectCat} — ${nombre || "Cliente"}`;

      const ownerIntro = esRetoque
        ? `<h2 style="color:#b8860b;">Ajuste de diseño solicitado</h2>
           <p>El cliente ha pedido cambios sobre el diseño anterior: <strong style="color:#e53e3e;">"${cambios_solicitados || sugerencias}"</strong></p>`
        : `<h2 style="color:#b8860b;">Nueva solicitud de diseño</h2>`;

      // Email al propietario
      try {
        const ownerRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: resendHeaders,
          body: JSON.stringify({
            from: "Romet Joyería <no-reply@rometjoyeria.com>",
            to: [PROPIETARIO_EMAIL],
            subject: ownerSubject,
            html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
              ${ownerIntro}
              <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                <tr><td style="padding:8px;border-bottom:1px solid #eee;width:120px;"><strong>Nombre</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${nombre || ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Teléfono</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${telefono || ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${email || ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Categoría</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${catEmailLabel}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Material</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${matEmailLabel}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Gema</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${insertPayload.gema_principal || gema_principal || ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Estilo</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${estilo || ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Perfil</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${perfil_usuario || ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Presupuesto</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${presupuesto ? presupuesto + "€" : ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Talla</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${talla_medida || ""}</td></tr>
                ${esRetoque ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#e53e3e;"><strong>Cambios</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#e53e3e;"><strong>${cambios_solicitados || sugerencias || ""}</strong></td></tr>` : ""}
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Notas iniciales</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${sugerencias || ""}</td></tr>
                <tr><td style="padding:8px;"><strong>Fecha</strong></td><td style="padding:8px;">${marca_temporal}</td></tr>
              </table>
              ${emailImageHtml}
            </div>`,
          }),
        });
        console.log("Owner email status:", ownerRes.status);
      } catch(e) { console.error("Owner email error:", e); }

      const clientSubject = esRetoque
        ? `Tu diseño de joya ajustado — Romet Joyería`
        : `Tu diseño de joya personalizado — Romet Joyería`;

      const clientIntro = esRetoque
        ? `<p>Hemos realizado las modificaciones solicitadas a tu diseño. Aquí tienes la nueva versión con los ajustes aplicados:</p>`
        : `<p>Hemos generado tu joya personalizada. Nos pondremos en contacto contigo muy pronto para hacerla realidad.</p>`;

      // Email al cliente
      try {
        const clientRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: resendHeaders,
          body: JSON.stringify({
            from: "Romet Joyería <no-reply@rometjoyeria.com>",
            to: [email],
            subject: clientSubject,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#b8860b;">Hola ${nombre || ""}, aquí tienes tu diseño</h2>
              ${clientIntro}
              ${emailImageHtml}
              <table style="width:100%;border-collapse:collapse;margin-top:24px;">
                <tr><td style="padding:8px;border-bottom:1px solid #eee;width:120px;"><strong>Categoría</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${CATEGORY_LABELS[categoria_producto] || categoria_producto || ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Material</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${MATERIAL_LABELS[material] || material || ""}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Gema</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${insertPayload.gema_principal || gema_principal || ""}</td></tr>
                ${esRetoque ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#e53e3e;"><strong>Cambios solicitados</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#e53e3e;"><strong>${cambios_solicitados || sugerencias || ""}</strong></td></tr>` : ""}
              </table>
              <p style="margin-top:24px;color:#888;">Con cariño, el equipo de Romet Joyería</p>
            </div>`,
          }),
        });
        console.log("Client email status:", clientRes.status);
      } catch(e) { console.error("Client email error:", e); }
    }

    return new Response(
      JSON.stringify({ success: true, imagenUrl, id: insertedData?.id, gema: gemaInfo.nombre }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("v82 ERROR:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
