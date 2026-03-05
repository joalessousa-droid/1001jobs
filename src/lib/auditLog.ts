import { supabase } from "@/integrations/supabase/client";

export async function logAuditEvent(params: {
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let profileId: string | null = null;
    try {
      const { data } = await supabase.rpc("get_my_profile_id");
      profileId = data;
    } catch { /* profile may not exist yet */ }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      profile_id: profileId,
      action: params.action,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      details: params.details || {},
      user_agent: navigator.userAgent,
    });
  } catch (err) {
    console.warn("Audit log failed:", err);
  }
}

export async function recordLGPDConsent(params: {
  consentType: string;
  accepted: boolean;
  version?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let profileId: string | null = null;
    try {
      const { data } = await supabase.rpc("get_my_profile_id");
      profileId = data;
    } catch { /* ok */ }

    await supabase.from("lgpd_consents").insert({
      user_id: user.id,
      profile_id: profileId,
      consent_type: params.consentType,
      consent_version: params.version || "1.0",
      accepted: params.accepted,
      user_agent: navigator.userAgent,
    });

    await logAuditEvent({
      action: params.accepted ? "consent_given" : "consent_revoked",
      entityType: "consent",
      details: { consent_type: params.consentType, version: params.version || "1.0" },
    });
  } catch (err) {
    console.warn("LGPD consent record failed:", err);
  }
}

export async function uploadKYCDocument(params: {
  userId: string;
  profileId: string;
  file: File;
  documentType: string;
}): Promise<string | null> {
  try {
    const ext = params.file.name.split(".").pop() || "jpg";
    const path = `${params.userId}/${params.documentType}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(path, params.file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("kyc-documents")
      .getPublicUrl(path);

    // Save record
    await supabase.from("kyc_documents").insert({
      profile_id: params.profileId,
      user_id: params.userId,
      document_type: params.documentType,
      file_url: path, // store path, not public url (private bucket)
      file_name: params.file.name,
    });

    await logAuditEvent({
      action: "kyc_upload",
      entityType: "kyc_document",
      details: { document_type: params.documentType, file_name: params.file.name },
    });

    return path;
  } catch (err) {
    console.warn("KYC upload failed:", err);
    return null;
  }
}
