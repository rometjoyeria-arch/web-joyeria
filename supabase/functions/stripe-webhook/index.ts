// stripe-webhook v8 — Soporte robusto para pagos únicos, suscripciones directas de Stripe y renovaciones automáticas
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const parts: Record<string, string> = {};
    sigHeader.split(',').forEach((item) => {
      const [key, value] = item.split('=');
      if (key && value) parts[key.trim()] = value.trim();
    });

    const timestamp = parts['t'];
    const signature = parts['v1'];

    if (!timestamp || !signature) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      console.warn('Webhook timestamp too old');
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      mismatch |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

function deducePlanFromAmount(amountCents: number) {
  if (amountCents === 495) {
    return { plan: 'particular', creditsToAdd: 3, isUnlimited: false, isCustomDesign: false };
  } else if (amountCents === 499) {
    return { plan: '10_designs', creditsToAdd: 10, isUnlimited: false, isCustomDesign: false };
  } else if (amountCents === 2490 || amountCents === 2499) {
    return { plan: 'profesional15', creditsToAdd: 15, isUnlimited: false, isCustomDesign: false };
  } else if (amountCents === 4490 || amountCents === 4499) {
    return { plan: 'profesional30', creditsToAdd: 30, isUnlimited: false, isCustomDesign: false };
  } else if (amountCents === 9900) {
    return { plan: 'profesionales_plus', creditsToAdd: 0, isUnlimited: true, isCustomDesign: false };
  } else if (amountCents === 14990 || amountCents === 14999 || amountCents === 4990) {
    return { plan: 'custom_design', creditsToAdd: 0, isUnlimited: false, isCustomDesign: true };
  }
  return { plan: 'unknown', creditsToAdd: 0, isUnlimited: false, isCustomDesign: false };
}

function deducePlanFromDetails(amountCents: number, description?: string) {
  const desc = (description || '').toLowerCase();
  if (desc.includes('plus') || desc.includes('ilimitad') || desc.includes('unlimited')) {
    return { plan: 'profesionales_plus', creditsToAdd: 0, isUnlimited: true, isCustomDesign: false };
  }
  if (desc.includes('30 diseño') || desc.includes('30 design') || desc.includes('profesional 30')) {
    return { plan: 'profesional30', creditsToAdd: 30, isUnlimited: false, isCustomDesign: false };
  }
  if (desc.includes('15 diseño') || desc.includes('15 design') || desc.includes('profesional 15')) {
    return { plan: 'profesional15', creditsToAdd: 15, isUnlimited: false, isCustomDesign: false };
  }
  if (desc.includes('particular') || desc.includes('3 diseño') || desc.includes('3 design')) {
    return { plan: 'particular', creditsToAdd: 3, isUnlimited: false, isCustomDesign: false };
  }
  return deducePlanFromAmount(amountCents);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || 'whsec_26Rjq9DLjvcT32RaxNsh3cTRhS7W7M7H';
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';

    const body = await req.text();
    const sigHeader = req.headers.get('stripe-signature');

    if (stripeWebhookSecret && sigHeader) {
      const isValid = await verifyStripeSignature(body, sigHeader, stripeWebhookSecret);
      if (!isValid) {
        console.warn('Invalid Stripe webhook signature');
        return jsonResponse({ error: 'Invalid signature' }, 401);
      }
    } else if (stripeWebhookSecret && !sigHeader) {
      return jsonResponse({ error: 'Missing stripe-signature header' }, 400);
    } else {
      console.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
    }

    const event = JSON.parse(body);
    console.log(`Stripe event received: ${event.type} (${event.id})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ══════════════════════════════════════════════════════════════════
    // 1. Checkout Session completado (Pago único o suscripción iniciada)
    // ══════════════════════════════════════════════════════════════════
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      let userId = session.metadata?.user_id;

      // Soporte para enlaces directos de pago de Stripe (Payment Links) con client_reference_id
      if (!userId && session.client_reference_id) {
        userId = session.client_reference_id.split(':')[0];
      }

      // Si aún no hay userId, buscar por email del cliente
      const customerEmail = (session.customer_details?.email || session.customer_email || '').toLowerCase().trim();
      if (!userId && customerEmail) {
        const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const matched = usersData?.users?.find((u: { email?: string }) => u.email?.toLowerCase().trim() === customerEmail);
        if (matched) {
          userId = matched.id;
        }
      }

      let amountTotal = session.amount_total || 0;
      const subscriptionId = session.subscription ? String(session.subscription) : null;
      let lineDescription = '';

      // Si amountTotal viene en 0 pero hay suscripción, consultar la suscripción en Stripe API para conocer el precio exacto
      if (amountTotal === 0 && subscriptionId && stripeSecretKey) {
        try {
          const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
            headers: { 'Authorization': `Bearer ${stripeSecretKey}` }
          });
          if (subRes.ok) {
            const subData = await subRes.json();
            const firstItem = subData.items?.data?.[0];
            const unitAmount = firstItem?.price?.unit_amount || firstItem?.plan?.amount || 0;
            if (unitAmount > 0) {
              amountTotal = unitAmount;
              console.log(`Fetched subscription unit_amount from Stripe API: ${amountTotal} cents`);
            }
            if (firstItem?.price?.nickname) lineDescription = firstItem.price.nickname;
            if (subData.metadata?.plan) {
              session.metadata = { ...(session.metadata || {}), plan: subData.metadata.plan };
            }
          }
        } catch (subErr) {
          console.warn('Could not fetch subscription details from Stripe:', subErr);
        }
      }

      const deduced = deducePlanFromDetails(amountTotal, lineDescription);
      const plan = session.metadata?.plan || (deduced.plan !== 'unknown' ? deduced.plan : null);
      const creditsToAdd = session.metadata?.credits_to_add 
        ? parseInt(session.metadata.credits_to_add) 
        : deduced.creditsToAdd;
      const isUnlimited = session.metadata?.is_unlimited === 'true' || deduced.isUnlimited;
      const isCustomDesign = deduced.isCustomDesign || plan === 'custom_design';

      if (!userId) {
        console.error('Missing userId for checkout session:', session.id, 'customer:', customerEmail);
        await supabase.from('pagos_stripe').insert({
          stripe_session_id: session.id,
          plan: plan || 'unknown',
          credits_added: creditsToAdd,
          amount_cents: amountTotal,
          currency: session.currency || 'eur',
          status: 'completed_unassigned',
        });
        return jsonResponse({ received: true, note: 'User not found, payment logged' });
      }

      console.log(`Processing checkout: user=${userId}, plan=${plan}, credits=${creditsToAdd}, unlimited=${isUnlimited}, sub=${subscriptionId}`);

      const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
      if (getUserError || !user) {
        console.error('Error fetching user:', getUserError?.message);
        return jsonResponse({ error: 'User not found' }, 404);
      }

      const currentCredits = user.user_metadata?.credits || 0;
      let newCredits = currentCredits;

      const newMetadata: Record<string, unknown> = {
        ...user.user_metadata,
      };

      if (plan) {
        newMetadata.plan = plan;
      }

      if (isUnlimited) {
        newMetadata.is_unlimited = true;
        if (subscriptionId) {
          newMetadata.subscription_id = subscriptionId;
          newMetadata.subscription_status = 'active';
        }
      } else if (creditsToAdd > 0) {
        newCredits = currentCredits + creditsToAdd;
        newMetadata.credits = newCredits;
        newMetadata.is_unlimited = false;
        if (subscriptionId) {
          newMetadata.subscription_id = subscriptionId;
          newMetadata.subscription_status = 'active';
        }
      } else if (subscriptionId) {
        // Enlace de suscripción donde el importe se procesará en invoice.payment_succeeded
        newMetadata.subscription_id = subscriptionId;
        newMetadata.subscription_status = 'active';
      } else if (isCustomDesign) {
        newMetadata.has_custom_design_order = true;
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: newMetadata,
      });

      if (updateError) {
        console.error('Error updating user metadata:', updateError.message);
        return jsonResponse({ error: 'Failed to update user' }, 500);
      }

      console.log(`✅ User metadata updated for ${userId}: plan=${newMetadata.plan}, credits=${newCredits}, unlimited=${isUnlimited}`);

      // Registrar el pago en la base de datos
      await supabase.from('pagos_stripe').insert({
        user_id: userId,
        stripe_session_id: session.id,
        plan: plan || 'pending_invoice',
        credits_added: creditsToAdd,
        amount_cents: amountTotal,
        currency: session.currency || 'eur',
        status: 'completed',
      });

      return jsonResponse({
        received: true,
        user_id: userId,
        credits_added: creditsToAdd,
        new_total: newCredits,
        is_unlimited: isUnlimited,
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. Factura de suscripción pagada (Alta inicial y renovaciones mensuales)
    // ══════════════════════════════════════════════════════════════════
    if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription ? String(invoice.subscription) : null;
      const amountPaid = invoice.amount_paid || 0;
      const customerEmail = (invoice.customer_email || '').toLowerCase().trim();
      const invoiceLineDesc = invoice.lines?.data?.[0]?.description || '';

      console.log(`Invoice event: sub=${subscriptionId}, email=${customerEmail}, amount=${amountPaid}, reason=${invoice.billing_reason}`);

      // Procesar cualquier factura pagada de una suscripción activa
      if (subscriptionId && amountPaid > 0) {
        // 1) Evitar duplicados si esta factura exacta ya se registró
        const { data: existingPayment } = await supabase
          .from('pagos_stripe')
          .select('id')
          .eq('stripe_session_id', `inv_${invoice.id}`)
          .maybeSingle();

        if (existingPayment) {
          console.log(`Invoice inv_${invoice.id} already processed. Skipping.`);
          return jsonResponse({ received: true, note: 'Already processed' });
        }

        // 2) Buscar al usuario por subscription_id o por email
        let targetUser = null;
        const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (usersData?.users) {
          targetUser = usersData.users.find((u: { user_metadata?: Record<string, unknown>; email?: string; id?: string }) => 
            u.user_metadata?.subscription_id === subscriptionId ||
            (customerEmail && u.email?.toLowerCase().trim() === customerEmail)
          );
        }

        if (targetUser) {
          const userId = targetUser.id;
          const deduced = deducePlanFromDetails(amountPaid, invoiceLineDesc);

          // Si es el cobro inicial ('subscription_create') y el checkout ya le sumó sus créditos
          const alreadyGrantedInCheckout = invoice.billing_reason === 'subscription_create' &&
            targetUser.user_metadata?.plan &&
            targetUser.user_metadata?.plan !== 'unknown' &&
            targetUser.user_metadata?.plan !== 'pending_invoice' &&
            targetUser.user_metadata?.subscription_id === subscriptionId &&
            ((targetUser.user_metadata?.credits || 0) > 0 || targetUser.user_metadata?.is_unlimited === true);

          if (alreadyGrantedInCheckout) {
            console.log(`Credits already granted during checkout for user ${userId}. Logging invoice.`);
            await supabase.from('pagos_stripe').insert({
              user_id: userId,
              stripe_session_id: `inv_${invoice.id}`,
              plan: deduced.plan,
              credits_added: 0,
              amount_cents: amountPaid,
              currency: invoice.currency || 'eur',
              status: 'completed',
            });
            return jsonResponse({ received: true, note: 'Invoice logged, credits already granted' });
          }

          // Otorgar créditos y actualizar plan
          const currentCredits = targetUser.user_metadata?.credits || 0;
          let newCredits = currentCredits;

          const updatedMetadata: Record<string, unknown> = {
            ...targetUser.user_metadata,
            plan: deduced.plan,
            subscription_id: subscriptionId,
            subscription_status: 'active',
          };

          if (deduced.isUnlimited) {
            updatedMetadata.is_unlimited = true;
          } else if (deduced.creditsToAdd > 0) {
            newCredits = currentCredits + deduced.creditsToAdd;
            updatedMetadata.credits = newCredits;
            updatedMetadata.is_unlimited = false;
          }

          const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: updatedMetadata,
          });

          if (updateErr) {
            console.error('Error updating user metadata from invoice:', updateErr.message);
            return jsonResponse({ error: 'Failed to update user' }, 500);
          }

          console.log(`✅ User ${userId} updated via invoice: plan=${deduced.plan}, credits=${newCredits}, amount=${amountPaid}`);

          await supabase.from('pagos_stripe').insert({
            user_id: userId,
            stripe_session_id: `inv_${invoice.id}`,
            plan: deduced.plan,
            credits_added: deduced.creditsToAdd,
            amount_cents: amountPaid,
            currency: invoice.currency || 'eur',
            status: 'completed',
          });

          return jsonResponse({
            received: true,
            user_id: userId,
            plan: deduced.plan,
            credits_added: deduced.creditsToAdd,
            new_credits: newCredits,
          });
        } else {
          console.warn(`Could not find user for invoice: sub=${subscriptionId}, email=${customerEmail}`);
          await supabase.from('pagos_stripe').insert({
            user_id: null,
            stripe_session_id: `inv_${invoice.id}`,
            plan: 'subscription_unassigned',
            credits_added: 0,
            amount_cents: amountPaid,
            currency: invoice.currency || 'eur',
            status: 'completed_unassigned',
          });
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. Suscripción cancelada o terminada
    // ══════════════════════════════════════════════════════════════════
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const subscriptionId = sub.id;

      const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const targetUser = usersData?.users?.find((u: { user_metadata?: Record<string, unknown> }) => 
        u.user_metadata?.subscription_id === subscriptionId
      );

      if (targetUser) {
        await supabase.auth.admin.updateUserById(targetUser.id, {
          user_metadata: {
            ...targetUser.user_metadata,
            is_unlimited: false,
            subscription_status: 'canceled',
            plan: null,
          },
        });
        console.log(`ℹ️ Subscription ${subscriptionId} ended for user ${targetUser.id}. Access revoked.`);
      }
    }

    return jsonResponse({ received: true, type: event.type });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Webhook processing error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
