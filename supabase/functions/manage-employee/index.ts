// Manager-only employee administration: create / update-profile / delete.
// Uses the service-role key server-side to call the Supabase Auth admin API -
// that key must never reach the browser, which is exactly why this exists as
// an edge function instead of a direct client-side call.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Scoped to the caller's own JWT - only used to find out who's calling.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    // Service-role client - bypasses RLS, only reachable through this function.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !callerProfile || callerProfile.role !== "Manager") {
      return json({ error: "Manager role required" }, 403);
    }

    const body = await req.json();
    const action = body.action;

    if (action === "create") {
      const { name, username, password, role } = body;
      if (!name || !username || !password) return json({ error: "Missing name/username/password" }, 400);

      const email = `${String(username).toLowerCase().trim()}@teamtasks.com`;

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 400);

      const { data: profileRow, error: insertErr } = await adminClient
        .from("users")
        .insert({ id: created.user.id, name, email, role: role || "Employee" })
        .select()
        .single();

      if (insertErr) {
        // Don't leave an orphaned auth account if the profile row failed.
        await adminClient.auth.admin.deleteUser(created.user.id);
        return json({ error: insertErr.message }, 400);
      }

      return json({ user: profileRow });
    }

    if (action === "updateProfile") {
      const { id, name, username, password, role, photo } = body;
      if (!id) return json({ error: "Missing id" }, 400);

      const email = username ? `${String(username).toLowerCase().trim()}@teamtasks.com` : undefined;

      const authUpdate: Record<string, unknown> = {};
      if (email) authUpdate.email = email;
      if (password) authUpdate.password = password;
      if (Object.keys(authUpdate).length > 0) {
        const { error: authErr } = await adminClient.auth.admin.updateUserById(id, authUpdate);
        if (authErr) return json({ error: authErr.message }, 400);
      }

      const profileUpdate: Record<string, unknown> = {};
      if (name) profileUpdate.name = name;
      if (email) profileUpdate.email = email;
      if (role) profileUpdate.role = role;
      if (photo !== undefined) profileUpdate.photo = photo;
      if (Object.keys(profileUpdate).length > 0) {
        const { error: updErr } = await adminClient.from("users").update(profileUpdate).eq("id", id);
        if (updErr) return json({ error: updErr.message }, 400);
      }

      return json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      if (id === userData.user.id) return json({ error: "Can't delete your own account" }, 400);

      await adminClient.from("users").delete().eq("id", id);
      const { error: delErr } = await adminClient.auth.admin.deleteUser(id);
      if (delErr) return json({ error: delErr.message }, 400);

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
