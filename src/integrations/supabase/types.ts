export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          client_id: string
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          provider_id: string
          scheduled_date: string
          scheduled_time: string
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          provider_id: string
          scheduled_date: string
          scheduled_time: string
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          provider_id?: string
          scheduled_date?: string
          scheduled_time?: string
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "provider_services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          profile_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          profile_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          profile_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      category_pricing: {
        Row: {
          category_id: string
          created_at: string
          currency: string
          id: string
          max_price: number | null
          min_price: number
          notes: string | null
          suggested_price: number
          unit: Database["public"]["Enums"]["pricing_unit"]
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          currency?: string
          id?: string
          max_price?: number | null
          min_price?: number
          notes?: string | null
          suggested_price?: number
          unit?: Database["public"]["Enums"]["pricing_unit"]
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          currency?: string
          id?: string
          max_price?: number | null
          min_price?: number
          notes?: string | null
          suggested_price?: number
          unit?: Database["public"]["Enums"]["pricing_unit"]
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          referred_id: string
          status: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          referred_id: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          referred_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_services: {
        Row: {
          appointment_id: string | null
          client_id: string
          completed_at: string
          created_at: string
          id: string
          notes: string | null
          provider_id: string
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          completed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          provider_id: string
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          completed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          provider_id?: string
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "provider_services"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          notes: string | null
          referrer: string | null
          status: string
          subject: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          notes?: string | null
          referrer?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          notes?: string | null
          referrer?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          participant_1: string
          participant_2: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_1: string
          participant_2: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_1?: string
          participant_2?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          min_value: number
          used_by: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          min_value?: number
          used_by?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          min_value?: number
          used_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_fingerprints: {
        Row: {
          canvas_hash: string | null
          city_geo: string | null
          color_depth: number | null
          country_geo: string | null
          created_at: string
          fingerprint_hash: string
          id: string
          ip_address: string | null
          is_blocked: boolean | null
          language: string | null
          latitude_geo: number | null
          longitude_geo: number | null
          platform: string | null
          profile_id: string | null
          screen_resolution: string | null
          state_geo: string | null
          timezone: string | null
          touch_support: boolean | null
          user_agent: string | null
          user_id: string
          webgl_renderer: string | null
        }
        Insert: {
          canvas_hash?: string | null
          city_geo?: string | null
          color_depth?: number | null
          country_geo?: string | null
          created_at?: string
          fingerprint_hash: string
          id?: string
          ip_address?: string | null
          is_blocked?: boolean | null
          language?: string | null
          latitude_geo?: number | null
          longitude_geo?: number | null
          platform?: string | null
          profile_id?: string | null
          screen_resolution?: string | null
          state_geo?: string | null
          timezone?: string | null
          touch_support?: boolean | null
          user_agent?: string | null
          user_id: string
          webgl_renderer?: string | null
        }
        Update: {
          canvas_hash?: string | null
          city_geo?: string | null
          color_depth?: number | null
          country_geo?: string | null
          created_at?: string
          fingerprint_hash?: string
          id?: string
          ip_address?: string | null
          is_blocked?: boolean | null
          language?: string | null
          latitude_geo?: number | null
          longitude_geo?: number | null
          platform?: string | null
          profile_id?: string | null
          screen_resolution?: string | null
          state_geo?: string | null
          timezone?: string | null
          touch_support?: boolean | null
          user_agent?: string | null
          user_id?: string
          webgl_renderer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_fingerprints_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_fingerprints_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_match_weights: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
          updated_by: string | null
          w_anti_cancel: number
          w_availability: number
          w_distance: number
          w_recurrence: number
          w_reputation: number
          w_response_time: number
          w_specialization: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          w_anti_cancel?: number
          w_availability?: number
          w_distance?: number
          w_recurrence?: number
          w_reputation?: number
          w_response_time?: number
          w_specialization?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          w_anti_cancel?: number
          w_availability?: number
          w_distance?: number
          w_recurrence?: number
          w_reputation?: number
          w_response_time?: number
          w_specialization?: number
        }
        Relationships: []
      }
      eta_alert_deliveries: {
        Row: {
          alert_id: string
          attempts: number
          channel: string
          created_at: string
          first_attempt_at: string | null
          hmac_validated: boolean | null
          hmac_validated_at: string | null
          hmac_validation_error: string | null
          http_status: number | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          metadata: Json | null
          payload_size: number | null
          signature: string | null
          signature_algo: string | null
          status: string
          target: string
          target_label: string | null
          template_id: string | null
          template_version: number | null
          webhook_id: string | null
          webhook_version: number | null
        }
        Insert: {
          alert_id: string
          attempts?: number
          channel: string
          created_at?: string
          first_attempt_at?: string | null
          hmac_validated?: boolean | null
          hmac_validated_at?: string | null
          hmac_validation_error?: string | null
          http_status?: number | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          metadata?: Json | null
          payload_size?: number | null
          signature?: string | null
          signature_algo?: string | null
          status?: string
          target: string
          target_label?: string | null
          template_id?: string | null
          template_version?: number | null
          webhook_id?: string | null
          webhook_version?: number | null
        }
        Update: {
          alert_id?: string
          attempts?: number
          channel?: string
          created_at?: string
          first_attempt_at?: string | null
          hmac_validated?: boolean | null
          hmac_validated_at?: string | null
          hmac_validation_error?: string | null
          http_status?: number | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          metadata?: Json | null
          payload_size?: number | null
          signature?: string | null
          signature_algo?: string | null
          status?: string
          target?: string
          target_label?: string | null
          template_id?: string | null
          template_version?: number | null
          webhook_id?: string | null
          webhook_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eta_alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "eta_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_alert_email_template_versions: {
        Row: {
          alert_type: string
          changed_by: string | null
          created_at: string
          html_body: string
          id: string
          name: string
          subject: string
          template_id: string
          version: number
        }
        Insert: {
          alert_type: string
          changed_by?: string | null
          created_at?: string
          html_body: string
          id?: string
          name: string
          subject: string
          template_id: string
          version: number
        }
        Update: {
          alert_type?: string
          changed_by?: string | null
          created_at?: string
          html_body?: string
          id?: string
          name?: string
          subject?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "eta_alert_email_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "eta_alert_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_alert_email_templates: {
        Row: {
          alert_type: string
          created_at: string
          html_body: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          html_body: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          html_body?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      eta_alert_rollback_log: {
        Row: {
          entity_id: string
          entity_type: string
          from_version: number | null
          id: string
          reason: string | null
          reverted_at: string
          reverted_by: string | null
          to_version: number
        }
        Insert: {
          entity_id: string
          entity_type: string
          from_version?: number | null
          id?: string
          reason?: string | null
          reverted_at?: string
          reverted_by?: string | null
          to_version: number
        }
        Update: {
          entity_id?: string
          entity_type?: string
          from_version?: number | null
          id?: string
          reason?: string | null
          reverted_at?: string
          reverted_by?: string | null
          to_version?: number
        }
        Relationships: []
      }
      eta_alert_webhook_versions: {
        Row: {
          alert_types: string[] | null
          changed_by: string | null
          created_at: string
          headers: Json | null
          id: string
          max_retries: number | null
          min_severity: string | null
          name: string
          url: string
          version: number
          webhook_id: string
        }
        Insert: {
          alert_types?: string[] | null
          changed_by?: string | null
          created_at?: string
          headers?: Json | null
          id?: string
          max_retries?: number | null
          min_severity?: string | null
          name: string
          url: string
          version: number
          webhook_id: string
        }
        Update: {
          alert_types?: string[] | null
          changed_by?: string | null
          created_at?: string
          headers?: Json | null
          id?: string
          max_retries?: number | null
          min_severity?: string | null
          name?: string
          url?: string
          version?: number
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eta_alert_webhook_versions_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "eta_alert_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_alert_webhooks: {
        Row: {
          alert_types: string[]
          created_at: string
          headers: Json
          id: string
          is_active: boolean
          max_retries: number
          min_severity: string
          name: string
          secret: string | null
          secret_expires_at: string | null
          secret_next: string | null
          secret_next_activates_at: string | null
          updated_at: string
          url: string
          version: number
        }
        Insert: {
          alert_types?: string[]
          created_at?: string
          headers?: Json
          id?: string
          is_active?: boolean
          max_retries?: number
          min_severity?: string
          name: string
          secret?: string | null
          secret_expires_at?: string | null
          secret_next?: string | null
          secret_next_activates_at?: string | null
          updated_at?: string
          url: string
          version?: number
        }
        Update: {
          alert_types?: string[]
          created_at?: string
          headers?: Json
          id?: string
          is_active?: boolean
          max_retries?: number
          min_severity?: string
          name?: string
          secret?: string | null
          secret_expires_at?: string | null
          secret_next?: string | null
          secret_next_activates_at?: string | null
          updated_at?: string
          url?: string
          version?: number
        }
        Relationships: []
      }
      eta_alerts: {
        Row: {
          alert_type: string
          avg_duration_ms: number | null
          avg_traffic_factor: number | null
          category_id: string | null
          city: string | null
          email_sent: boolean
          failure_rate: number | null
          failures: number | null
          id: string
          p95_duration_ms: number | null
          period_from: string
          period_to: string
          provider_id: string | null
          resolved_at: string | null
          samples: number | null
          severity: string
          summary: Json
          ts: string
          tuning_snapshot: Json | null
          webhook_error: string | null
          webhook_status: number | null
        }
        Insert: {
          alert_type: string
          avg_duration_ms?: number | null
          avg_traffic_factor?: number | null
          category_id?: string | null
          city?: string | null
          email_sent?: boolean
          failure_rate?: number | null
          failures?: number | null
          id?: string
          p95_duration_ms?: number | null
          period_from: string
          period_to: string
          provider_id?: string | null
          resolved_at?: string | null
          samples?: number | null
          severity?: string
          summary?: Json
          ts?: string
          tuning_snapshot?: Json | null
          webhook_error?: string | null
          webhook_status?: number | null
        }
        Update: {
          alert_type?: string
          avg_duration_ms?: number | null
          avg_traffic_factor?: number | null
          category_id?: string | null
          city?: string | null
          email_sent?: boolean
          failure_rate?: number | null
          failures?: number | null
          id?: string
          p95_duration_ms?: number | null
          period_from?: string
          period_to?: string
          provider_id?: string | null
          resolved_at?: string | null
          samples?: number | null
          severity?: string
          summary?: Json
          ts?: string
          tuning_snapshot?: Json | null
          webhook_error?: string | null
          webhook_status?: number | null
        }
        Relationships: []
      }
      eta_metrics: {
        Row: {
          category_id: string | null
          degraded: boolean | null
          distance_meters: number | null
          duration_ms: number | null
          error: string | null
          eta_seconds: number | null
          http_status: number | null
          id: number
          ok: boolean
          provider_id: string | null
          region_key: string | null
          regional_weight: number | null
          retries: number | null
          service_id: string | null
          traffic_factor: number | null
          traffic_level: string | null
          ts: string
        }
        Insert: {
          category_id?: string | null
          degraded?: boolean | null
          distance_meters?: number | null
          duration_ms?: number | null
          error?: string | null
          eta_seconds?: number | null
          http_status?: number | null
          id?: number
          ok: boolean
          provider_id?: string | null
          region_key?: string | null
          regional_weight?: number | null
          retries?: number | null
          service_id?: string | null
          traffic_factor?: number | null
          traffic_level?: string | null
          ts?: string
        }
        Update: {
          category_id?: string | null
          degraded?: boolean | null
          distance_meters?: number | null
          duration_ms?: number | null
          error?: string | null
          eta_seconds?: number | null
          http_status?: number | null
          id?: number
          ok?: boolean
          provider_id?: string | null
          region_key?: string | null
          regional_weight?: number | null
          retries?: number | null
          service_id?: string | null
          traffic_factor?: number | null
          traffic_level?: string | null
          ts?: string
        }
        Relationships: []
      }
      eta_tuning_overrides: {
        Row: {
          created_at: string
          day_of_week: number | null
          ema_alpha: number | null
          hour_of_day: number | null
          id: string
          is_active: boolean
          max_regional_weight: number | null
          notes: string | null
          scope: string
          scope_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          ema_alpha?: number | null
          hour_of_day?: number | null
          id?: string
          is_active?: boolean
          max_regional_weight?: number | null
          notes?: string | null
          scope: string
          scope_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          ema_alpha?: number | null
          hour_of_day?: number | null
          id?: string
          is_active?: boolean
          max_regional_weight?: number | null
          notes?: string | null
          scope?: string
          scope_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      face_verification_attempts: {
        Row: {
          attempt_at: string
          attempt_path: string | null
          baseline_path: string | null
          context: string
          decision: string
          fingerprint_hash: string | null
          id: string
          ip_address: string | null
          notes: string | null
          profile_id: string
          similarity: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          attempt_at?: string
          attempt_path?: string | null
          baseline_path?: string | null
          context: string
          decision: string
          fingerprint_hash?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          profile_id: string
          similarity?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          attempt_at?: string
          attempt_path?: string | null
          baseline_path?: string | null
          context?: string
          decision?: string
          fingerprint_hash?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          profile_id?: string
          similarity?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      investor_kpis: {
        Row: {
          gmv_anual: number | null
          id: number
          receita_anual: number | null
          recompra: number | null
          taxa_conclusao: number | null
          tempo_aceite_seconds: number | null
          ticket_medio: number | null
          updated_at: string
        }
        Insert: {
          gmv_anual?: number | null
          id?: number
          receita_anual?: number | null
          recompra?: number | null
          taxa_conclusao?: number | null
          tempo_aceite_seconds?: number | null
          ticket_medio?: number | null
          updated_at?: string
        }
        Update: {
          gmv_anual?: number | null
          id?: number
          receita_anual?: number | null
          recompra?: number | null
          taxa_conclusao?: number | null
          tempo_aceite_seconds?: number | null
          ticket_medio?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      investor_leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      kyc_decisions: {
        Row: {
          city: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          operator_id: string | null
          profile_id: string
          reason: string | null
          rejection_category: string | null
          submission_id: string
          to_status: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          operator_id?: string | null
          profile_id: string
          reason?: string | null
          rejection_category?: string | null
          submission_id: string
          to_status: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          operator_id?: string | null
          profile_id?: string
          reason?: string | null
          rejection_category?: string | null
          submission_id?: string
          to_status?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string | null
          file_url: string
          id: string
          profile_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name?: string | null
          file_url: string
          id?: string
          profile_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string | null
          file_url?: string
          id?: string
          profile_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          submission_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          submission_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          submission_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_status_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "kyc_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          cnh_number: string | null
          cpf: string | null
          cpf_checked_at: string | null
          cpf_regularidade: string | null
          cpf_valid: boolean | null
          created_at: string
          decided_at: string | null
          doc_back_path: string | null
          doc_front_path: string | null
          doc_valid: boolean | null
          face_match_score: number | null
          id: string
          ocr_checked_at: string | null
          ocr_cpf_match: boolean | null
          ocr_extracted: Json | null
          ocr_name_match: number | null
          profile_id: string
          rejection_category: string | null
          rejection_reason: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          rg_number: string | null
          selfie_path: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cnh_number?: string | null
          cpf?: string | null
          cpf_checked_at?: string | null
          cpf_regularidade?: string | null
          cpf_valid?: boolean | null
          created_at?: string
          decided_at?: string | null
          doc_back_path?: string | null
          doc_front_path?: string | null
          doc_valid?: boolean | null
          face_match_score?: number | null
          id?: string
          ocr_checked_at?: string | null
          ocr_cpf_match?: boolean | null
          ocr_extracted?: Json | null
          ocr_name_match?: number | null
          profile_id: string
          rejection_category?: string | null
          rejection_reason?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          rg_number?: string | null
          selfie_path?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cnh_number?: string | null
          cpf?: string | null
          cpf_checked_at?: string | null
          cpf_regularidade?: string | null
          cpf_valid?: boolean | null
          created_at?: string
          decided_at?: string | null
          doc_back_path?: string | null
          doc_front_path?: string | null
          doc_valid?: boolean | null
          face_match_score?: number | null
          id?: string
          ocr_checked_at?: string | null
          ocr_cpf_match?: boolean | null
          ocr_extracted?: Json | null
          ocr_name_match?: number | null
          profile_id?: string
          rejection_category?: string | null
          rejection_reason?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          rg_number?: string | null
          selfie_path?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lgpd_consents: {
        Row: {
          accepted: boolean
          consent_type: string
          consent_version: string
          created_at: string
          id: string
          ip_address: string | null
          profile_id: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted?: boolean
          consent_type: string
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          profile_id?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted?: boolean
          consent_type?: string
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          profile_id?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json
          profile_id: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json
          profile_id: string
          read?: boolean
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json
          profile_id?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      partner_clicks: {
        Row: {
          created_at: string
          event_type: string
          id: string
          partner_slug: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          partner_slug: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          partner_slug?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      partner_leads: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          institution: string
          message: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          id?: string
          institution: string
          message: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          institution?: string
          message?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          provider_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          provider_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          provider_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          affiliate_code: string
          affiliate_level: string
          avatar_url: string | null
          bio: string | null
          business_hours: string | null
          capital_social: number | null
          cep: string | null
          city: string | null
          cnae: string | null
          cpf_cnpj: string | null
          created_at: string
          data_abertura: string | null
          date_of_birth: string | null
          display_name: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          mother_name: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          person_type: string | null
          phone: string | null
          professional_registration: string | null
          razao_social: string | null
          referred_by: string | null
          representative_birth_date: string | null
          representative_cpf: string | null
          representative_email: string | null
          representative_name: string | null
          representative_phone: string | null
          representative_role: string | null
          state: string | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          verification_status: Database["public"]["Enums"]["verification_status"]
          years_experience: number | null
        }
        Insert: {
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          affiliate_code: string
          affiliate_level?: string
          avatar_url?: string | null
          bio?: string | null
          business_hours?: string | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          cnae?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_abertura?: string | null
          date_of_birth?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          mother_name?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          person_type?: string | null
          phone?: string | null
          professional_registration?: string | null
          razao_social?: string | null
          referred_by?: string | null
          representative_birth_date?: string | null
          representative_cpf?: string | null
          representative_email?: string | null
          representative_name?: string | null
          representative_phone?: string | null
          representative_role?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"]
          verification_status?: Database["public"]["Enums"]["verification_status"]
          years_experience?: number | null
        }
        Update: {
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          affiliate_code?: string
          affiliate_level?: string
          avatar_url?: string | null
          bio?: string | null
          business_hours?: string | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          cnae?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_abertura?: string | null
          date_of_birth?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          mother_name?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          person_type?: string | null
          phone?: string | null
          professional_registration?: string | null
          razao_social?: string | null
          referred_by?: string | null
          representative_birth_date?: string | null
          representative_cpf?: string | null
          representative_email?: string | null
          representative_name?: string | null
          representative_phone?: string | null
          representative_role?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          verification_status?: Database["public"]["Enums"]["verification_status"]
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_availability: {
        Row: {
          current_load: number
          is_busy: boolean
          is_online: boolean
          last_seen_at: string
          max_concurrent: number
          provider_id: string
          updated_at: string
        }
        Insert: {
          current_load?: number
          is_busy?: boolean
          is_online?: boolean
          last_seen_at?: string
          max_concurrent?: number
          provider_id: string
          updated_at?: string
        }
        Update: {
          current_load?: number
          is_busy?: boolean
          is_online?: boolean
          last_seen_at?: string
          max_concurrent?: number
          provider_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_location_history: {
        Row: {
          accuracy: number | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          provider_id: string
          recorded_at: string
          service_id: string | null
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          provider_id: string
          recorded_at?: string
          service_id?: string | null
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          provider_id?: string
          recorded_at?: string
          service_id?: string | null
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_location_history_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_location_history_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_location_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_locations: {
        Row: {
          accuracy: number | null
          heading: number | null
          is_public: boolean
          is_sharing: boolean
          latitude: number
          longitude: number
          provider_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          is_public?: boolean
          is_sharing?: boolean
          latitude: number
          longitude: number
          provider_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          is_public?: boolean
          is_sharing?: boolean
          latitude?: number
          longitude?: number
          provider_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_locations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_locations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_ranking_scores: {
        Row: {
          computed_at: string
          provider_id: string
          sample_size: number
          score_anti_cancel: number
          score_proximity: number
          score_rating: number
          score_recurrence: number
          score_specialization: number
          score_total: number
          updated_at: string
        }
        Insert: {
          computed_at?: string
          provider_id: string
          sample_size?: number
          score_anti_cancel?: number
          score_proximity?: number
          score_rating?: number
          score_recurrence?: number
          score_specialization?: number
          score_total?: number
          updated_at?: string
        }
        Update: {
          computed_at?: string
          provider_id?: string
          sample_size?: number
          score_anti_cancel?: number
          score_proximity?: number
          score_rating?: number
          score_recurrence?: number
          score_specialization?: number
          score_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      provider_services: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          hourly_rate: number | null
          id: string
          provider_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          hourly_rate?: number | null
          id?: string
          provider_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          hourly_rate?: number | null
          id?: string
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_traffic_stats: {
        Row: {
          avg_speed_kmh: number
          city: string | null
          created_at: string
          day_of_week: number
          hour_of_day: number
          id: string
          last_sample_at: string
          region_key: string
          sample_count: number
          state: string | null
          updated_at: string
        }
        Insert: {
          avg_speed_kmh: number
          city?: string | null
          created_at?: string
          day_of_week: number
          hour_of_day: number
          id?: string
          last_sample_at?: string
          region_key: string
          sample_count?: number
          state?: string | null
          updated_at?: string
        }
        Update: {
          avg_speed_kmh?: number
          city?: string | null
          created_at?: string
          day_of_week?: number
          hour_of_day?: number
          id?: string
          last_sample_at?: string
          region_key?: string
          sample_count?: number
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reputation_scores: {
        Row: {
          badges: string[] | null
          dispute_rate: number
          id: string
          last_review_at: string | null
          profile_id: string
          score_breakdown: Json
          total_disputes: number
          total_reviews: number
          updated_at: string
          weighted_score: number
        }
        Insert: {
          badges?: string[] | null
          dispute_rate?: number
          id?: string
          last_review_at?: string | null
          profile_id: string
          score_breakdown?: Json
          total_disputes?: number
          total_reviews?: number
          updated_at?: string
          weighted_score?: number
        }
        Update: {
          badges?: string[] | null
          dispute_rate?: number
          id?: string
          last_review_at?: string | null
          profile_id?: string
          score_breakdown?: Json
          total_disputes?: number
          total_reviews?: number
          updated_at?: string
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "reputation_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_disputes: {
        Row: {
          created_at: string
          decision: string | null
          disputed_by: string
          evidence_urls: string[] | null
          id: string
          moderator_id: string | null
          moderator_notes: string | null
          penalty_applied: string | null
          reason: string
          resolved_at: string | null
          review_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision?: string | null
          disputed_by: string
          evidence_urls?: string[] | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          penalty_applied?: string | null
          reason: string
          resolved_at?: string | null
          review_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string | null
          disputed_by?: string
          evidence_urls?: string[] | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          penalty_applied?: string | null
          reason?: string
          resolved_at?: string | null
          review_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_disputes_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_disputes_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_disputes_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_disputes_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_disputes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_evidence: {
        Row: {
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          review_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          review_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_evidence_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_fraud_logs: {
        Row: {
          created_at: string
          details: Json
          flagged_for_mediation: boolean
          fraud_type: string
          id: string
          review_id: string
          reviewer_id: string
          score: number
        }
        Insert: {
          created_at?: string
          details?: Json
          flagged_for_mediation?: boolean
          fraud_type: string
          id?: string
          review_id: string
          reviewer_id: string
          score?: number
        }
        Update: {
          created_at?: string
          details?: Json
          flagged_for_mediation?: boolean
          fraud_type?: string
          id?: string
          review_id?: string
          reviewer_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_fraud_logs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_fraud_logs_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_fraud_logs_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_subcriteria: {
        Row: {
          created_at: string
          criterion: string
          id: string
          review_id: string
          score: number
        }
        Insert: {
          created_at?: string
          criterion: string
          id?: string
          review_id: string
          score: number
        }
        Update: {
          created_at?: string
          criterion?: string
          id?: string
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_subcriteria_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          completed_service_id: string | null
          created_at: string
          fraud_score: number
          id: string
          is_contested: boolean
          is_published: boolean
          is_shadow: boolean
          publish_at: string | null
          rating: number
          review_type: string
          reviewed_id: string
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          completed_service_id?: string | null
          created_at?: string
          fraud_score?: number
          id?: string
          is_contested?: boolean
          is_published?: boolean
          is_shadow?: boolean
          publish_at?: string | null
          rating: number
          review_type?: string
          reviewed_id: string
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          completed_service_id?: string | null
          created_at?: string
          fraud_score?: number
          id?: string
          is_contested?: boolean
          is_published?: boolean
          is_shadow?: boolean
          publish_at?: string | null
          rating?: number
          review_type?: string
          reviewed_id?: string
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_completed_service_id_fkey"
            columns: ["completed_service_id"]
            isOneToOne: false
            referencedRelation: "completed_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewed_id_fkey"
            columns: ["reviewed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewed_id_fkey"
            columns: ["reviewed_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          created_at: string
          factors: Json
          id: string
          profile_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string
          score: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          factors?: Json
          id?: string
          profile_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          score?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          factors?: Json
          id?: string
          profile_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          score?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      service_dispute_evidence: {
        Row: {
          created_at: string
          dispute_id: string
          file_urls: string[]
          id: string
          message: string | null
          submitted_by: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          file_urls?: string[]
          id?: string
          message?: string | null
          submitted_by: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          file_urls?: string[]
          id?: string
          message?: string | null
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "service_disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_disputes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          moderator_id: string | null
          moderator_notes: string | null
          opened_by: string
          reason: string
          refund_amount: number | null
          resolution: string | null
          resolved_at: string | null
          service_id: string
          status: Database["public"]["Enums"]["service_dispute_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          opened_by: string
          reason: string
          refund_amount?: number | null
          resolution?: string | null
          resolved_at?: string | null
          service_id: string
          status?: Database["public"]["Enums"]["service_dispute_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          opened_by?: string
          reason?: string
          refund_amount?: number | null
          resolution?: string | null
          resolved_at?: string | null
          service_id?: string
          status?: Database["public"]["Enums"]["service_dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_disputes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_matching_logs: {
        Row: {
          client_id: string | null
          created_at: string
          details: Json
          id: string
          outcome: string
          providers_found: number
          providers_notified: number
          radius_km: number
          service_id: string | null
          service_request_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          outcome?: string
          providers_found?: number
          providers_notified?: number
          radius_km: number
          service_id?: string | null
          service_request_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          outcome?: string
          providers_found?: number
          providers_notified?: number
          radius_km?: number
          service_id?: string | null
          service_request_id?: string | null
        }
        Relationships: []
      }
      service_offers: {
        Row: {
          client_id: string
          created_at: string
          distance_km: number | null
          expires_at: string
          id: string
          match_score: number
          metadata: Json
          offered_at: string
          provider_id: string
          queue_position: number
          radius_km: number | null
          responded_at: string | null
          service_id: string | null
          service_request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          distance_km?: number | null
          expires_at?: string
          id?: string
          match_score?: number
          metadata?: Json
          offered_at?: string
          provider_id: string
          queue_position?: number
          radius_km?: number | null
          responded_at?: string | null
          service_id?: string | null
          service_request_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          distance_km?: number | null
          expires_at?: string
          id?: string
          match_score?: number
          metadata?: Json
          offered_at?: string
          provider_id?: string
          queue_position?: number
          radius_km?: number | null
          responded_at?: string | null
          service_id?: string | null
          service_request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_payment_audit_logs: {
        Row: {
          actor_profile_id: string | null
          actor_user_id: string | null
          amount: number | null
          created_at: string
          currency: string | null
          error_detail: Json | null
          event_type: string
          id: string
          ip_address: string | null
          message: string | null
          payload: Json
          payment_id: string | null
          service_id: string | null
          source: string
          status: string
          stripe_event_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          actor_user_id?: string | null
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_detail?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          message?: string | null
          payload?: Json
          payment_id?: string | null
          service_id?: string | null
          source: string
          status?: string
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          actor_user_id?: string | null
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_detail?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          payload?: Json
          payment_id?: string | null
          service_id?: string | null
          source?: string
          status?: string
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      service_payments: {
        Row: {
          amount: number
          authorized_at: string | null
          captured_at: string | null
          client_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          metadata: Json
          platform_fee: number
          provider_id: string
          refund_amount: number | null
          refunded_at: string | null
          released_at: string | null
          service_id: string
          state: Database["public"]["Enums"]["service_payment_state"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          authorized_at?: string | null
          captured_at?: string | null
          client_id: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          metadata?: Json
          platform_fee?: number
          provider_id: string
          refund_amount?: number | null
          refunded_at?: string | null
          released_at?: string | null
          service_id: string
          state?: Database["public"]["Enums"]["service_payment_state"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          captured_at?: string | null
          client_id?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          metadata?: Json
          platform_fee?: number
          provider_id?: string
          refund_amount?: number | null
          refunded_at?: string | null
          released_at?: string | null
          service_id?: string
          state?: Database["public"]["Enums"]["service_payment_state"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_proposals: {
        Row: {
          amount: number
          created_at: string
          currency: string
          estimated_days: number | null
          id: string
          message: string | null
          provider_id: string
          service_request_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          estimated_days?: number | null
          id?: string
          message?: string | null
          provider_id: string
          service_request_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          estimated_days?: number | null
          id?: string
          message?: string | null
          provider_id?: string
          service_request_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_proposals_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "public_service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_proposals_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          budget: number | null
          category_id: string
          city: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          price_type: Database["public"]["Enums"]["service_price_type"]
          profile_id: string | null
          requester_name: string
          requester_type: string
          selected_provider_id: string | null
          service_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["service_request_status"]
          updated_at: string
        }
        Insert: {
          budget?: number | null
          category_id: string
          city?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          price_type?: Database["public"]["Enums"]["service_price_type"]
          profile_id?: string | null
          requester_name: string
          requester_type?: string
          selected_provider_id?: string | null
          service_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["service_request_status"]
          updated_at?: string
        }
        Update: {
          budget?: number | null
          category_id?: string
          city?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          price_type?: Database["public"]["Enums"]["service_price_type"]
          profile_id?: string | null
          requester_name?: string
          requester_type?: string
          selected_provider_id?: string | null
          service_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["service_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_status_history: {
        Row: {
          changed_by: string
          created_at: string
          from_status: Database["public"]["Enums"]["service_status"] | null
          id: string
          reason: string | null
          service_id: string
          to_status: Database["public"]["Enums"]["service_status"]
        }
        Insert: {
          changed_by: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["service_status"] | null
          id?: string
          reason?: string | null
          service_id: string
          to_status: Database["public"]["Enums"]["service_status"]
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["service_status"] | null
          id?: string
          reason?: string | null
          service_id?: string
          to_status?: Database["public"]["Enums"]["service_status"]
        }
        Relationships: [
          {
            foreignKeyName: "service_status_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_tracking: {
        Row: {
          avg_speed_kmh: number | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          destination_address: string | null
          destination_city: string | null
          destination_lat: number | null
          destination_lng: number | null
          destination_state: string | null
          distance_meters: number | null
          duration_in_traffic_seconds: number | null
          eta_history: Json
          eta_seconds: number | null
          last_eta_at: string | null
          regional_avg_speed_kmh: number | null
          route_polyline: string | null
          service_id: string
          state: string
          traffic_factor: number | null
          updated_at: string
        }
        Insert: {
          avg_speed_kmh?: number | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          destination_address?: string | null
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_state?: string | null
          distance_meters?: number | null
          duration_in_traffic_seconds?: number | null
          eta_history?: Json
          eta_seconds?: number | null
          last_eta_at?: string | null
          regional_avg_speed_kmh?: number | null
          route_polyline?: string | null
          service_id: string
          state?: string
          traffic_factor?: number | null
          updated_at?: string
        }
        Update: {
          avg_speed_kmh?: number | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          destination_address?: string | null
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_state?: string | null
          distance_meters?: number | null
          duration_in_traffic_seconds?: number | null
          eta_history?: Json
          eta_seconds?: number | null
          last_eta_at?: string | null
          regional_avg_speed_kmh?: number | null
          route_polyline?: string | null
          service_id?: string
          state?: string
          traffic_factor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_tracking_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          agreed_price: number | null
          appointment_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          category_id: string | null
          client_id: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          description: string | null
          dispute_reason: string | null
          disputed_at: string | null
          id: string
          payment_status: Database["public"]["Enums"]["service_payment_status"]
          price_type: Database["public"]["Enums"]["service_price_type"]
          provider_id: string
          service_request_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agreed_price?: number | null
          appointment_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category_id?: string | null
          client_id: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["service_payment_status"]
          price_type?: Database["public"]["Enums"]["service_price_type"]
          provider_id: string
          service_request_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agreed_price?: number | null
          appointment_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category_id?: string | null
          client_id?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["service_payment_status"]
          price_type?: Database["public"]["Enums"]["service_price_type"]
          provider_id?: string
          service_request_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          id: string
          profile_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          profile_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_intent_corrections: {
        Row: {
          corrected_by_user_id: string | null
          corrected_intent: string
          created_at: string
          id: string
          log_id: string
          notes: string | null
          original_intent: string | null
          question: string | null
        }
        Insert: {
          corrected_by_user_id?: string | null
          corrected_intent: string
          created_at?: string
          id?: string
          log_id: string
          notes?: string | null
          original_intent?: string | null
          question?: string | null
        }
        Update: {
          corrected_by_user_id?: string | null
          corrected_intent?: string
          created_at?: string
          id?: string
          log_id?: string
          notes?: string | null
          original_intent?: string | null
          question?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_intent_corrections_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "support_chat_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_intent_training: {
        Row: {
          created_at: string
          id: string
          intent: string
          question: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent: string
          question: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          intent?: string
          question?: string
          source?: string
        }
        Relationships: []
      }
      support_chat_logs: {
        Row: {
          answer_preview: string | null
          completion_tokens: number | null
          created_at: string
          error_message: string | null
          http_status: number | null
          id: string
          intent_category: string | null
          intent_corrected: boolean
          ip_address: string | null
          is_pro: boolean | null
          metadata: Json
          model: string | null
          profile_id: string | null
          prompt_tokens: number | null
          question: string | null
          question_length: number | null
          response_time_ms: number | null
          session_id: string | null
          status: string
          total_tokens: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          answer_preview?: string | null
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          intent_category?: string | null
          intent_corrected?: boolean
          ip_address?: string | null
          is_pro?: boolean | null
          metadata?: Json
          model?: string | null
          profile_id?: string | null
          prompt_tokens?: number | null
          question?: string | null
          question_length?: number | null
          response_time_ms?: number | null
          session_id?: string | null
          status?: string
          total_tokens?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          answer_preview?: string | null
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          intent_category?: string | null
          intent_corrected?: boolean
          ip_address?: string | null
          is_pro?: boolean | null
          metadata?: Json
          model?: string | null
          profile_id?: string | null
          prompt_tokens?: number | null
          question?: string | null
          question_length?: number | null
          response_time_ms?: number | null
          session_id?: string | null
          status?: string
          total_tokens?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      support_chat_weekly_reports: {
        Row: {
          created_at: string
          email_error: string | null
          email_status: string
          generated_at: string
          id: string
          payload: Json
          period_from: string
          period_to: string
          recipients: string[]
          subject: string
        }
        Insert: {
          created_at?: string
          email_error?: string | null
          email_status?: string
          generated_at?: string
          id?: string
          payload: Json
          period_from: string
          period_to: string
          recipients?: string[]
          subject: string
        }
        Update: {
          created_at?: string
          email_error?: string | null
          email_status?: string
          generated_at?: string
          id?: string
          payload?: Json
          period_from?: string
          period_to?: string
          recipients?: string[]
          subject?: string
        }
        Relationships: []
      }
      task_applications: {
        Row: {
          applicant_profile_id: string
          conversation_id: string | null
          created_at: string
          id: string
          service_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          applicant_profile_id: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          service_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_profile_id?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          service_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_applications_applicant_profile_id_fkey"
            columns: ["applicant_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_applications_applicant_profile_id_fkey"
            columns: ["applicant_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_applications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_applications_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "public_service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_applications_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          affiliate_code: string | null
          affiliate_level: string | null
          avatar_url: string | null
          bio: string | null
          business_hours: string | null
          city: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          nome_fantasia: string | null
          professional_registration: string | null
          state: string | null
          user_id: string | null
          user_type: Database["public"]["Enums"]["user_type"] | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          years_experience: number | null
        }
        Insert: {
          affiliate_code?: string | null
          affiliate_level?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_hours?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          nome_fantasia?: string | null
          professional_registration?: string | null
          state?: string | null
          user_id?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          years_experience?: number | null
        }
        Update: {
          affiliate_code?: string | null
          affiliate_level?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_hours?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          nome_fantasia?: string | null
          professional_registration?: string | null
          state?: string | null
          user_id?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          years_experience?: number | null
        }
        Relationships: []
      }
      public_service_requests: {
        Row: {
          budget: number | null
          category_id: string | null
          city: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          price_type: Database["public"]["Enums"]["service_price_type"] | null
          profile_id: string | null
          requester_type: string | null
          selected_provider_id: string | null
          service_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["service_request_status"] | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          category_id?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          latitude?: never
          longitude?: never
          price_type?: Database["public"]["Enums"]["service_price_type"] | null
          profile_id?: string | null
          requester_type?: string | null
          selected_provider_id?: string | null
          service_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["service_request_status"] | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          category_id?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          latitude?: never
          longitude?: never
          price_type?: Database["public"]["Enums"]["service_price_type"] | null
          profile_id?: string | null
          requester_type?: string | null
          selected_provider_id?: string | null
          service_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["service_request_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      v_provider_offer_metrics: {
        Row: {
          acceptance_rate: number | null
          accepted: number | null
          avg_response_seconds: number | null
          declined: number | null
          expired: number | null
          last_offer_at: string | null
          provider_id: string | null
          superseded: number | null
          total_offers: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_service_offer: { Args: { _offer_id: string }; Returns: string }
      accept_service_proposal: {
        Args: { _proposal_id: string }
        Returns: string
      }
      acquire_dispatch_lock: {
        Args: { _service_request_id: string }
        Returns: undefined
      }
      apply_intent_correction: {
        Args: { _corrected_intent: string; _log_id: string; _notes?: string }
        Returns: Json
      }
      calculate_provider_score: {
        Args: {
          _category_id?: string
          _client_id: string
          _distance_km: number
          _provider_id: string
        }
        Returns: number
      }
      can_access_service_payment: {
        Args: { _payment_id: string }
        Returns: boolean
      }
      decline_service_offer: { Args: { _offer_id: string }; Returns: undefined }
      expire_stale_offers: { Args: never; Returns: number }
      export_kyc_decisions: {
        Args: { _city?: string; _from: string; _to: string }
        Returns: {
          city: string
          created_at: string
          from_status: string
          operator_id: string
          reason: string
          rejection_category: string
          submission_id: string
          to_status: string
          user_id: string
        }[]
      }
      get_affiliate_dashboard: { Args: { _profile_id: string }; Returns: Json }
      get_dispatch_dashboard: { Args: never; Returns: Json }
      get_dispatch_funnel: {
        Args: { _from?: string; _group_by?: string; _to?: string }
        Returns: Json
      }
      get_eta_metrics_dashboard: { Args: { _minutes?: number }; Returns: Json }
      get_kyc_metrics: {
        Args: { _city?: string; _from: string; _to: string }
        Returns: Json
      }
      get_matching_logs_admin: {
        Args: {
          _decision?: string
          _from?: string
          _limit?: number
          _service_request_id?: string
          _to?: string
        }
        Returns: {
          client_id: string | null
          created_at: string
          details: Json
          id: string
          outcome: string
          providers_found: number
          providers_notified: number
          radius_km: number
          service_id: string | null
          service_request_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "service_matching_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_offer_history: {
        Args: { _from?: string; _status?: string; _to?: string }
        Returns: {
          client_id: string
          created_at: string
          distance_km: number | null
          expires_at: string
          id: string
          match_score: number
          metadata: Json
          offered_at: string
          provider_id: string
          queue_position: number
          radius_km: number | null
          responded_at: string | null
          service_id: string | null
          service_request_id: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "service_offers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_offer_metrics: { Args: never; Returns: Json }
      get_my_profile_id: { Args: never; Returns: string }
      get_support_chat_alerts: { Args: never; Returns: Json }
      get_support_chat_metrics: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      get_support_chat_metrics_segmented: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      get_support_chat_weekly_report: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_service_peer: {
        Args: { _provider_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      is_profile_owner: { Args: { _profile_id: string }; Returns: boolean }
      is_provider_profile: { Args: { _profile_id: string }; Returns: boolean }
      is_valid_cpf: { Args: { _cpf: string }; Returns: boolean }
      log_service_payment_event: {
        Args: {
          _amount?: number
          _currency?: string
          _error_detail?: Json
          _event_type: string
          _ip_address?: string
          _message?: string
          _payload?: Json
          _payment_id: string
          _service_id: string
          _source: string
          _status?: string
          _stripe_event_id?: string
          _stripe_payment_intent_id?: string
          _stripe_session_id?: string
          _user_agent?: string
        }
        Returns: string
      }
      log_support_chat_event: {
        Args: {
          _answer_preview?: string
          _completion_tokens?: number
          _error_message?: string
          _http_status?: number
          _intent_category?: string
          _ip_address?: string
          _metadata?: Json
          _model?: string
          _profile_id?: string
          _prompt_tokens?: number
          _question: string
          _response_time_ms?: number
          _session_id: string
          _status?: string
          _total_tokens?: number
          _user_agent?: string
          _user_id?: string
        }
        Returns: string
      }
      open_service_dispute: {
        Args: { _description?: string; _reason: string; _service_id: string }
        Returns: string
      }
      promote_eta_webhook_next_secret: {
        Args: { _webhook_id: string }
        Returns: Json
      }
      publish_blind_reviews: { Args: never; Returns: number }
      recompute_provider_ranking: {
        Args: { _provider_id?: string }
        Returns: number
      }
      record_service_refund: {
        Args: { _amount: number; _full: boolean; _service_id: string }
        Returns: {
          amount: number
          authorized_at: string | null
          captured_at: string | null
          client_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          metadata: Json
          platform_fee: number
          provider_id: string
          refund_amount: number | null
          refunded_at: string | null
          released_at: string | null
          service_id: string
          state: Database["public"]["Enums"]["service_payment_state"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_service_payment: {
        Args: { _service_id: string }
        Returns: {
          amount: number
          authorized_at: string | null
          captured_at: string | null
          client_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          metadata: Json
          platform_fee: number
          provider_id: string
          refund_amount: number | null
          refunded_at: string | null
          released_at: string | null
          service_id: string
          state: Database["public"]["Enums"]["service_payment_state"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_eta_tuning: {
        Args: {
          _category_id: string
          _city: string
          _dow: number
          _hour: number
          _provider_id: string
        }
        Returns: Json
      }
      resolve_service_dispute: {
        Args: {
          _decision: string
          _dispute_id: string
          _moderator_notes?: string
          _refund_amount?: number
          _resolution: string
        }
        Returns: {
          created_at: string
          description: string | null
          id: string
          moderator_id: string | null
          moderator_notes: string | null
          opened_by: string
          reason: string
          refund_amount: number | null
          resolution: string | null
          resolved_at: string | null
          service_id: string
          status: Database["public"]["Enums"]["service_dispute_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rollback_eta_template: {
        Args: { _reason?: string; _template_id: string; _to_version: number }
        Returns: Json
      }
      rollback_eta_webhook: {
        Args: { _reason?: string; _to_version: number; _webhook_id: string }
        Returns: Json
      }
      rotate_eta_webhook_secret: {
        Args: {
          _activates_at?: string
          _expires_at?: string
          _new_secret: string
          _webhook_id: string
        }
        Returns: Json
      }
      transition_service_status: {
        Args: {
          _new_status: Database["public"]["Enums"]["service_status"]
          _reason?: string
          _service_id: string
        }
        Returns: {
          agreed_price: number | null
          appointment_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          category_id: string | null
          client_id: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          description: string | null
          dispute_reason: string | null
          disputed_at: string | null
          id: string
          payment_status: Database["public"]["Enums"]["service_payment_status"]
          price_type: Database["public"]["Enums"]["service_price_type"]
          provider_id: string
          service_request_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "services"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_affiliate_level: { Args: { _profile_id: string }; Returns: string }
      upsert_regional_traffic_sample:
        | {
            Args: {
              _city: string
              _dow: number
              _hour: number
              _region_key: string
              _speed_kmh: number
              _state: string
            }
            Returns: {
              avg_speed_kmh: number
              city: string | null
              created_at: string
              day_of_week: number
              hour_of_day: number
              id: string
              last_sample_at: string
              region_key: string
              sample_count: number
              state: string | null
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "regional_traffic_stats"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _alpha?: number
              _city: string
              _dow: number
              _hour: number
              _region_key: string
              _speed_kmh: number
              _state: string
            }
            Returns: {
              avg_speed_kmh: number
              city: string | null
              created_at: string
              day_of_week: number
              hour_of_day: number
              id: string
              last_sample_at: string
              region_key: string
              sample_count: number
              state: string | null
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "regional_traffic_stats"
              isOneToOne: true
              isSetofReturn: false
            }
          }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      pricing_unit: "hour" | "visit" | "project" | "service"
      proposal_status: "pending" | "accepted" | "rejected" | "withdrawn"
      service_dispute_status:
        | "open"
        | "evidence_requested"
        | "under_review"
        | "resolved_client"
        | "resolved_provider"
        | "resolved_split"
        | "closed_no_action"
      service_payment_state:
        | "pending"
        | "authorized"
        | "captured"
        | "released"
        | "refunded"
        | "partial_refund"
        | "failed"
        | "cancelled"
      service_payment_status: "pending" | "paid" | "refunded" | "released"
      service_price_type: "fixed" | "hourly" | "auction" | "negotiated"
      service_request_status: "open" | "assigned" | "closed" | "cancelled"
      service_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "confirmed"
        | "cancelled_by_client"
        | "cancelled_by_provider"
        | "disputed"
        | "refunded"
      user_type: "client" | "provider"
      verification_status: "unverified" | "pending" | "verified"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      pricing_unit: ["hour", "visit", "project", "service"],
      proposal_status: ["pending", "accepted", "rejected", "withdrawn"],
      service_dispute_status: [
        "open",
        "evidence_requested",
        "under_review",
        "resolved_client",
        "resolved_provider",
        "resolved_split",
        "closed_no_action",
      ],
      service_payment_state: [
        "pending",
        "authorized",
        "captured",
        "released",
        "refunded",
        "partial_refund",
        "failed",
        "cancelled",
      ],
      service_payment_status: ["pending", "paid", "refunded", "released"],
      service_price_type: ["fixed", "hourly", "auction", "negotiated"],
      service_request_status: ["open", "assigned", "closed", "cancelled"],
      service_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "confirmed",
        "cancelled_by_client",
        "cancelled_by_provider",
        "disputed",
        "refunded",
      ],
      user_type: ["client", "provider"],
      verification_status: ["unverified", "pending", "verified"],
    },
  },
} as const
