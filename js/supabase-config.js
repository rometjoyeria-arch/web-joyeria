// ═══════════════════════════════════════════════════════════
// ROMET JOYERIA - Supabase Configuration (Shared Module)
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://ktysptwemewbyanagdwu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0eXNwdHdlbWV3YnlhbmFnZHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDgwNTcsImV4cCI6MjA5MTIyNDA1N30.TMngS67DASOUD1s6VH8MZa_XDEwMEIG1VSowkc8yx0E';

let _supabaseClient = null;
function getSupabase() {
	if (!_supabaseClient) {
		const { createClient } = supabase;
		_supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
	}
	return _supabaseClient;
}

async function getSession() {
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

async function initHeaderAuth() {
	const session = await getSession();
	const authLink = document.getElementById('header-auth-link');
	if (!authLink) return;

	if (session) {
		const name = session.user.user_metadata?.first_name 
			|| session.user.user_metadata?.full_name
			|| session.user.email.split('@')[0];

		authLink.textContent = 'Cerrar Sesion';
		authLink.href = '#';
		authLink.onclick = async (e) => {
			e.preventDefault();
			await signOut();
		};

		const nav = authLink.parentElement;
		if (nav && !nav.querySelector('.user-greeting')) {
			const greeting = document.createElement('span');
			greeting.className = 'user-greeting text-xs md:text-sm tracking-[0.1em] text-muted-foreground uppercase hidden md:inline';
			greeting.textContent = 'Hola, ' + name;
			nav.insertBefore(greeting, authLink);
		}
	}
}

async function callEdgeFunction(functionName, payload) {
	const session = await getSession();
	const headers = {
		'Content-Type': 'application/json',
		'apikey': SUPABASE_ANON_KEY,
	};
	if (session) {
		headers['Authorization'] = 'Bearer ' + session.access_token;
	}

	const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Edge function error (${response.status}): ${errorText}`);
	}

	return response.json();
}

async function saveDesignOrder(designData) {
	const sb = getSupabase();
	const user = await getUser();

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
