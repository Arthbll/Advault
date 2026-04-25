/**
 * Client Supabase avec la service role key.
 *
 * ⚠️  Usage réservé aux routes serveur et aux cron jobs.
 *     Ne jamais exposer ce client côté client (browser).
 *     Ce client bypasse les Row Level Security policies — s'en servir uniquement
 *     pour des opérations légitimes (lecture des user_metadata dans le cron, etc.)
 */
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant — le client admin ne peut pas être créé."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
