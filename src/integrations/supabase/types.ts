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
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "commissions_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "completed_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "coupons_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        ]
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
        ]
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
        ]
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
        ]
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
            foreignKeyName: "review_disputes_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        ]
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
          ip_address: string | null
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
          ip_address?: string | null
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
          ip_address?: string | null
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
      [_ in never]: never
    }
    Functions: {
      accept_service_proposal: {
        Args: { _proposal_id: string }
        Returns: string
      }
      can_access_service_payment: {
        Args: { _payment_id: string }
        Returns: boolean
      }
      get_affiliate_dashboard: { Args: { _profile_id: string }; Returns: Json }
      get_my_profile_id: { Args: never; Returns: string }
      get_support_chat_metrics: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      is_profile_owner: { Args: { _profile_id: string }; Returns: boolean }
      is_provider_profile: { Args: { _profile_id: string }; Returns: boolean }
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
      publish_blind_reviews: { Args: never; Returns: number }
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
