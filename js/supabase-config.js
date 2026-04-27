// ═══════════════════════════════════════════════════════════
// ROMET JOYERIA - Supabase Configuration (Shared Module)
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://ktysptwemewbyanagdwu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0eXNwdHdlbWV3YnlhbmFnZHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDgwNTcsImV4cCI6MjA5MTIyNDA1N30.TMngS67DASOUD1s6VH8MZa_XDEwMEIG1VSowkc8yx0E';

let _supabaseClient = null;

function getSupabase() {
	if (!_supabaseClient) {
		const supabaseLib = window.supabase;
		if (!supabaseLib) {
			throw new Error('Supabase SDK no cargado aún');
		}
		const { createClient } = supabaseLib;
		_supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
	}
	return _supabaseClient;
}

async function ensureSupabaseReady() {
	return new Promise((resolve) => {
		function check() {
			if (typeof window.supabase !== 'undefined') {
				if (!_supabaseClient) {
					const { createClient } = window.supabase;
					_supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
				}
				resolve();
			} else {
				setTimeout(check, 100);
			}
		}
		check();
	});
}

async function getSession() {
	await ensureSupabaseReady();
	const sb = getSupabase();
	const { data: { session } } = await sb.auth.getSession();
	return session;
}

async function getUser() {
	const session = await getSession();
	return session?.user || null;
}

async function requireAuth(redirectTo = './login.html') {
	const session = await getSession();
	if (!session) {
		window.location.href = redirectTo;
		return null;
	}
	return session;
}

async function signOut() {
	const sb = getSupabase();
	await sb.auth.signOut();
	window.location.href = './index.html';
}

async function getCredits() {
	const session = await getSession();
	if (!session) return 0;
	let credits = session.user.user_metadata?.credits;
	if (credits === undefined) {
		credits = 10;
		const sb = getSupabase();
		await sb.auth.updateUser({ data: { credits: 10 } });
	}
	return credits;
}

async function consumeCredit() {
	const session = await getSession();
	if (!session) return false;
	let credits = await getCredits();
	if (credits <= 0) return false;
	
	credits -= 1;
	const sb = getSupabase();
	await sb.auth.updateUser({ data: { credits: credits } });
	
	const creditDisplay = document.getElementById('credit-count-display');
	if (creditDisplay) {
		creditDisplay.textContent = credits;
	}
	return true;
}

async function initHeaderAuth() {
	try {
		const session = await getSession();
		const authLink = document.getElementById('header-auth-link');
		if (!authLink) return;

		if (session) {
			const name = session.user.user_metadata?.first_name
				|| session.user.user_metadata?.full_name
				|| session.user.email.split('@')[0];
			
			const credits = await getCredits();

			const container = document.createElement('div');
			container.style.cssText = 'position:relative; display:inline-block;';
			container.innerHTML = `
				<button id="user-menu-btn" class="text-sm md:text-base tracking-[0.15em] uppercase text-foreground hover:text-muted-foreground transition-colors font-medium flex items-center gap-2" style="background:none; border:none; cursor:pointer;">
					Hola, ${name} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
				</button>
				<div id="user-dropdown" style="display:none; position:absolute; right:0; top:100%; margin-top:8px; width:230px; background:white; border:1px solid hsl(0 0% 85%); box-shadow:0 10px 25px rgba(0,0,0,0.08); z-index:100; text-align:left; border-radius:4px; overflow:hidden;">
					<div style="padding:16px; border-bottom:1px solid hsl(0 0% 85%); background:hsl(0 0% 98%);">
						 <div style="font-size:0.75rem; color:hsl(0 0% 40%); padding-bottom:6px; letter-spacing:0.1em; text-transform:uppercase; font-family: ui-sans-serif, system-ui, sans-serif;">Tus Créditos</div>
						 <div style="font-size:1.6rem; font-weight:600; color:hsl(0 0% 15%); display:flex; align-items:center; gap:8px;">
							 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
							 <span id="credit-count-display">${credits}</span>
						 </div>
					</div>
					<a href="javascript:void(0)" onclick="alert('La compra de créditos estará disponible muy pronto')" style="display:block; padding:12px 16px; color:hsl(0 0% 15%); text-decoration:none; font-size:0.8rem; font-family: ui-sans-serif, system-ui, sans-serif; letter-spacing:0.1em; text-transform:uppercase; border-bottom:1px solid hsl(0 0% 90%); transition:background 0.2s;" onmouseover="this.style.background='hsl(0 0% 95%)'" onmouseout="this.style.background='transparent'">
						 Comprar Créditos
					</a>
					<a href="#" id="logout-btn" style="display:block; padding:12px 16px; color:#e53e3e; text-decoration:none; font-size:0.8rem; font-family: ui-sans-serif, system-ui, sans-serif; letter-spacing:0.1em; text-transform:uppercase; transition:background 0.2s;" onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='transparent'">
						 Cerrar Sesión
					</a>
				</div>
			`;
			
			const nav = authLink.parentElement;
			nav.replaceChild(container, authLink);
			
			// Si existía un saludo antiguo 'Hola, Francisco', lo eliminamos porque ya va en el dropdown
			const existingGreeting = nav.querySelector('.user-greeting');
			if (existingGreeting) existingGreeting.remove();
			
			const btn = container.querySelector('#user-menu-btn');
			const dropdown = container.querySelector('#user-dropdown');
			const logoutBtn = container.querySelector('#logout-btn');
			
			btn.onclick = (e) => {
				e.preventDefault();
				dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
			};
			
			document.addEventListener('click', (e) => {
				if(!container.contains(e.target)) dropdown.style.display = 'none';
			});
			
			logoutBtn.onclick = async (e) => {
				e.preventDefault();
				await signOut();
			};
		}
	} catch(e) {
		console.warn('initHeaderAuth error:', e);
	}
}

// ═══════════════════════════════════════
// Llamada directa a Edge Function sin SDK
// ═══════════════════════════════════════
async function callEdgeFunction(functionName, payload) {
	const session = await getSession();
	// Si el usuario está conectado, usamos su token personal (JWT) hiperseguro.
	// Si no, recaemos en anon_key (lo cual debería fallar en el servidor por seguridad).
	const authHeader = session ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`;

	const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'apikey': SUPABASE_ANON_KEY,
			'Authorization': authHeader,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Edge function error (${response.status}): ${errorText}`);
	}

	return response.json();
}

async function saveDesignOrder(designData) {
	await ensureSupabaseReady();
	const sb = getSupabase();

	const record = {
		nombre: designData.customer_name || null,
		telefono: designData.customer_phone || null,
		email: designData.customer_email || null,
		categoria_producto: designData.category || null,
		material: designData.material || null,
		perfil_usuario: designData.profile || null,
		gema_principal: designData.gemstone || null,
		estilo: designData.style || null,
		presupuesto: designData.budget ? String(designData.budget) : null,
		peso_estimado: designData.weight ? String(designData.weight) : null,
		talla_medida: designData.size || null,
		sugerencias: designData.notes || null,
		imagen_generada_url: designData.image_url || null,
		marca_temporal: new Date().toISOString(),
	};

	const { data, error } = await sb
		.from('solicitudes_disenos_romet')
		.insert(record)
		.select()
		.single();

	if (error) throw error;
	return data;
}

async function uploadImage(file, bucket = 'disenos') {
	await ensureSupabaseReady();
	const sb = getSupabase();
	const ext = file.name.split('.').pop();
	const fileName = `upload_${Date.now()}.${ext}`;

	const { data, error } = await sb.storage
		.from(bucket)
		.upload(fileName, file, {
			cacheControl: '3600',
			upsert: false,
		});

	if (error) throw error;

	const { data: urlData } = sb.storage
		.from(bucket)
		.getPublicUrl(data.path);

	return urlData.publicUrl;
}

// ═══════════════════════════════════════
// Inicialización con reintento automático
// ═══════════════════════════════════════
function initWhenReady(callback) {
	if (typeof window.supabase !== 'undefined') {
		if (!_supabaseClient) {
			const { createClient } = window.supabase;
			_supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
		}
		if (callback) callback();
	} else {
		setTimeout(() => initWhenReady(callback), 100);
	}
}

window.showOutOfCreditsModal = function() {
	const overlay = document.createElement('div');
	overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000; backdrop-filter:blur(4px); animation:fadeIn 0.3s;';
	
	const modal = document.createElement('div');
	modal.style.cssText = 'background:hsl(0 0% 98%); padding:40px; border-radius:16px; max-width:400px; text-align:center; box-shadow:0 25px 50px rgba(0,0,0,0.15); border:1px solid hsl(0 0% 85%); position:relative;';
	
	modal.innerHTML = `
		<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="2" style="margin:0 auto 16px;">
			<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
		<h2 style="font-family:'Cormorant Garamond', serif; font-size:2rem; font-weight:600; margin-bottom:12px; color:hsl(0 0% 15%); text-transform:uppercase; letter-spacing:0.1em;">Sin Créditos</h2>
		<p style="font-family: ui-sans-serif, system-ui, sans-serif; color:hsl(0 0% 40%); margin-bottom:24px; font-size:0.95rem; line-height:1.5;">
			Has agotado todas tus generaciones de diseño. Adquiere más créditos para seguir creando magia joyera.
		</p>
		<button onclick="alert('La pasarela de pago estará disponible muy pronto.'); this.closest('div').parentElement.remove()" style="background:hsl(0 0% 0%); color:white; border:none; padding:14px 24px; width:100%; text-transform:uppercase; font-family:ui-sans-serif, system-ui, sans-serif; letter-spacing:0.15em; font-size:0.85rem; font-weight:500; cursor:pointer; margin-bottom:12px; transition:all 0.3s;" onmouseover="this.style.background='hsl(0 0% 20%)'" onmouseout="this.style.background='hsl(0 0% 0%)'">
			Comprar Créditos
		</button>
		<button onclick="this.closest('div').parentElement.remove()" style="background:transparent; color:hsl(0 0% 40%); border:1px solid hsl(0 0% 80%); padding:12px 24px; width:100%; text-transform:uppercase; font-family:ui-sans-serif, system-ui, sans-serif; letter-spacing:0.15em; font-size:0.85rem; font-weight:500; cursor:pointer; transition:all 0.3s;" onmouseover="this.style.background='hsl(0 0% 95%)'; this.style.color='hsl(0 0% 15%)'" onmouseout="this.style.background='transparent'; this.style.color='hsl(0 0% 40%)'">
			Cancelar
		</button>
	`;
	
	overlay.appendChild(modal);
	document.body.appendChild(overlay);
};

window.addEventListener('load', () => initWhenReady(null));
