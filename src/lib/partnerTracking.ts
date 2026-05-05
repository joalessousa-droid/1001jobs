import { supabase } from "@/integrations/supabase/client";

export const trackPartnerEvent = async (slug: string, eventType: "card_click" | "email_cta_click" | "website_click" | "link_click") => {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    await supabase.from("partner_clicks" as any).insert({
      partner_slug: slug,
      event_type: eventType,
      user_id: userRes?.user?.id ?? null,
      user_agent: navigator.userAgent.slice(0, 500),
      referrer: document.referrer.slice(0, 500) || null,
    });
  } catch (e) {
    // silent
  }
};
