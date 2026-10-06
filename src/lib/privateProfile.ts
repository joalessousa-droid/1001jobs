import { supabase } from "@/integrations/supabase/client";

/** Lê perfis completos (com CPF, telefone, endereço...) — só retorna o próprio perfil ou, para admin, os pedidos. */
export async function getPrivateProfiles(opts: { profileIds?: string[]; userIds?: string[] }) {
  const { data, error } = await supabase.rpc("get_profiles_private" as never, {
    _profile_ids: opts.profileIds ?? null,
    _user_ids: opts.userIds ?? null,
  } as never);
  return { data: ((data ?? []) as unknown) as any[], error };
}

export async function getPrivateProfile(opts: { profileId?: string; userId?: string }) {
  const { data, error } = await getPrivateProfiles({
    profileIds: opts.profileId ? [opts.profileId] : undefined,
    userIds: opts.userId ? [opts.userId] : undefined,
  });
  return { data: data[0] ?? null, error };
}
