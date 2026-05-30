import { supabase } from "@/integrations/supabase/client";

interface NotifyParams {
  event: "created" | "confirmed" | "cancelled";
  providerId: string;
  clientId: string;
  scheduledDate: string;
  scheduledTime: string;
  serviceName?: string;
  notes?: string;
}

export async function notifyAppointment(params: NotifyParams) {
  try {
    // Fetch profile + email for both parties
    const [providerRes, clientRes] = await Promise.all([
      (supabase as any).from("public_profiles").select("display_name, user_id").eq("id", params.providerId).single(),
      (supabase as any).from("public_profiles").select("display_name, user_id").eq("id", params.clientId).single(),
    ]);

    if (!providerRes.data || !clientRes.data) return;

    // Get emails from auth (we'll pass user_ids to the edge function which will use service role)
    // Since we can't access auth.users from client, we pass user_ids and let the function handle it
    // Actually, simpler: we'll just use the supabase client to get the current user's email
    // and fetch the other from the edge function. But the simplest approach is to send
    // the notification without emails from client and resolve them server-side.
    
    // For now, invoke the edge function with profile info
    const { error } = await supabase.functions.invoke("notify-appointment", {
      body: {
        event: params.event,
        provider_name: providerRes.data.display_name,
        client_name: clientRes.data.display_name,
        provider_user_id: providerRes.data.user_id,
        client_user_id: clientRes.data.user_id,
        scheduled_date: params.scheduledDate,
        scheduled_time: params.scheduledTime,
        service_name: params.serviceName,
        notes: params.notes,
      },
    });

    if (error) console.error("Notification error:", error);
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
}
