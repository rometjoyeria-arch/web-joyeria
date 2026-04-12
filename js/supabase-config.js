const SUPABASE_URL = 'https://ktysptwemewbyanagdwu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OnMCs7UahBVGhl8ey4RjsQ_eu0CU2Nq';

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

async function signOut() {
      const sb = getSupabase();
      await sb.auth.signOut();
      window.location.href = './index.html';
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
                ...designData,
                user_id: user?.id || null,
                user_email: user?.email || designData.email || null,
                status: 'pending',
                created_at: new Date().toISOString(),
      };
      const { data, error } = await sb
          .from('design_orders')
          .insert(record)
          .select()
          .single();
      if (error) throw error;
      return data;
}

async function uploadImage(file, bucket = 'design-uploads') {
      const sb = getSupabase();
      const user = await getUser();
      const ext = file.name.split('.').pop();
      const fileName = `${user?.id || 'anonymous'}/${Date.now()}.${ext}`;
      const { data, error } = await sb.storage
          .from(bucket)
          .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: urlData } = sb.storage.from(bucket).getPublicUrl(data.path);
      return urlData.publicUrl;
}

async function getUserOrders() {
      const sb = getSupabase();
      const user = await getUser();
      if (!user) return [];
      const { data, error } = await sb
          .from('design_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
}

async function initHeaderAuth() {
      const session = await getSession();
      const authLink = document.getElementById('header-auth-link');
      if (!authLink) return;
      if (session) {
                const name = session.user.user_metadata?.first_name || session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                authLink.textContent = 'Cerrar Sesion';
                authLink.href = '#';
                authLink.onclick = async (e) => {
                              e.preventDefault();
                              await signOut();
                };
      }
}
