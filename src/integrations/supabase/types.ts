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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_source_map: {
        Row: {
          campaign_pattern: string | null
          created_at: string
          id: string
          lead_source: string
          provider: string
          updated_at: string
        }
        Insert: {
          campaign_pattern?: string | null
          created_at?: string
          id?: string
          lead_source: string
          provider: string
          updated_at?: string
        }
        Update: {
          campaign_pattern?: string | null
          created_at?: string
          id?: string
          lead_source?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_spend: {
        Row: {
          account_id: string
          campaign_id: string
          campaign_name: string
          clicks: number
          cost: number
          created_at: string
          id: string
          impressions: number
          lead_source: string | null
          provider: string
          spend_date: string
          updated_at: string
        }
        Insert: {
          account_id: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          cost?: number
          created_at?: string
          id?: string
          impressions?: number
          lead_source?: string | null
          provider: string
          spend_date: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          cost?: number
          created_at?: string
          id?: string
          impressions?: number
          lead_source?: string | null
          provider?: string
          spend_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_sync_runs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          period_end: string | null
          period_start: string | null
          provider: string
          rows_upserted: number
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          provider: string
          rows_upserted?: number
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          provider?: string
          rows_upserted?: number
          status?: string
        }
        Relationships: []
      }
      booking_reminders: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          message_id: string | null
          offset_minutes: number
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_type: string
          recipient_user_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          message_id?: string | null
          offset_minutes: number
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_type: string
          recipient_user_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          message_id?: string | null
          offset_minutes?: number
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_type?: string
          recipient_user_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      calculations: {
        Row: {
          arbete_timmar: number
          arbete_timpris: number
          att_betala: number
          created_at: string
          created_by: string
          id: string
          lead_id: string
          marginal_procent: number
          material_key: string | null
          moms: number
          notes: string | null
          plat_items: Json
          ranndalar_meter: number
          roof_area_kvm: number
          rot_avdrag: boolean
          rot_belopp: number
          subtotal: number
          tillagg: Json
          total: number
          updated_at: string
        }
        Insert: {
          arbete_timmar?: number
          arbete_timpris?: number
          att_betala?: number
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          marginal_procent?: number
          material_key?: string | null
          moms?: number
          notes?: string | null
          plat_items?: Json
          ranndalar_meter?: number
          roof_area_kvm?: number
          rot_avdrag?: boolean
          rot_belopp?: number
          subtotal?: number
          tillagg?: Json
          total?: number
          updated_at?: string
        }
        Update: {
          arbete_timmar?: number
          arbete_timpris?: number
          att_betala?: number
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          marginal_procent?: number
          material_key?: string | null
          moms?: number
          notes?: string | null
          plat_items?: Json
          ranndalar_meter?: number
          roof_area_kvm?: number
          rot_avdrag?: boolean
          rot_belopp?: number
          subtotal?: number
          tillagg?: Json
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_shares_roles: {
        Row: {
          created_at: string
          event_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          event_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          event_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_shares_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_shares_users: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_shares_users_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          agenda: Json
          all_day: boolean
          created_at: string
          description: string | null
          end_at: string
          id: string
          job_id: string | null
          lead_id: string | null
          location: string | null
          owner_id: string
          side: string
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: Json
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          job_id?: string | null
          lead_id?: string | null
          location?: string | null
          owner_id: string
          side: string
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: Json
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          job_id?: string | null
          lead_id?: string | null
          location?: string | null
          owner_id?: string
          side?: string
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          company_name: string | null
          created_at: string
          email: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          hourly_rate: number | null
          id: string
          monthly_salary: number | null
          notes: string | null
          org_number: string | null
          personal_number: string | null
          phone: string | null
          provision_rate: number | null
          provision_rate_inbound: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          company_name?: string | null
          created_at?: string
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name: string
          hourly_rate?: number | null
          id?: string
          monthly_salary?: number | null
          notes?: string | null
          org_number?: string | null
          personal_number?: string | null
          phone?: string | null
          provision_rate?: number | null
          provision_rate_inbound?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          company_name?: string | null
          created_at?: string
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          hourly_rate?: number | null
          id?: string
          monthly_salary?: number | null
          notes?: string | null
          org_number?: string | null
          personal_number?: string | null
          phone?: string | null
          provision_rate?: number | null
          provision_rate_inbound?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      job_estimate_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          job_id: string
          new_value: number | null
          old_value: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          job_id: string
          new_value?: number | null
          old_value?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          job_id?: string
          new_value?: number | null
          old_value?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_estimate_audit_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_members_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          assigned_to: string | null
          assignment_type:
            | Database["public"]["Enums"]["job_assignment_type"]
            | null
          client_company: string | null
          client_contact_name: string | null
          client_email: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          estimated_hours: number | null
          fixed_price: number | null
          hide_time_estimate: boolean
          id: string
          job_type: Database["public"]["Enums"]["job_type"] | null
          lead_id: string | null
          notes: string | null
          self_checks_emailed_at: string | null
          self_checks_emailed_to: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          work_order_pdf_path: string | null
          work_order_processed_at: string | null
          work_order_summary: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          assignment_type?:
            | Database["public"]["Enums"]["job_assignment_type"]
            | null
          client_company?: string | null
          client_contact_name?: string | null
          client_email?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          estimated_hours?: number | null
          fixed_price?: number | null
          hide_time_estimate?: boolean
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"] | null
          lead_id?: string | null
          notes?: string | null
          self_checks_emailed_at?: string | null
          self_checks_emailed_to?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          work_order_pdf_path?: string | null
          work_order_processed_at?: string | null
          work_order_summary?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          assignment_type?:
            | Database["public"]["Enums"]["job_assignment_type"]
            | null
          client_company?: string | null
          client_contact_name?: string | null
          client_email?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          estimated_hours?: number | null
          fixed_price?: number | null
          hide_time_estimate?: boolean
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"] | null
          lead_id?: string | null
          notes?: string | null
          self_checks_emailed_at?: string | null
          self_checks_emailed_to?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          work_order_pdf_path?: string | null
          work_order_processed_at?: string | null
          work_order_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          created_at: string
          description: string
          id: string
          lead_id: string
          metadata: Json | null
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          lead_id: string
          metadata?: Json | null
          type: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          lead_id: string
          mime_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          lead_id: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          lead_id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          age: number | null
          assigned_to: string | null
          assignment_type: string | null
          booking_date: string | null
          commission_rate: number | null
          completed_at: string | null
          contact_person_id: string | null
          created_at: string
          created_by: string | null
          economy_note: string | null
          email: string | null
          external_id: string | null
          foreman_name: string | null
          id: string
          invoice_due_date: string | null
          invoiced: boolean
          invoiced_at: string | null
          job_type: Database["public"]["Enums"]["job_type"]
          last_contact: string | null
          lost_at: string | null
          lost_competitor: string | null
          lost_note: string | null
          lost_reason: Database["public"]["Enums"]["lost_reason"] | null
          material_cost: number | null
          name: string
          needs_offer: boolean
          next_action_at: string | null
          next_action_note: string | null
          notes: string | null
          offer_accepted_at: string | null
          offer_pdf_path: string | null
          personal_number: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          price: number | null
          property_id: string | null
          rot_amount: number | null
          rot_applied_at: string | null
          rot_eligible: boolean
          rot_paid: boolean
          score: number | null
          seller_id: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          subcontractor_name: string | null
          subcontractor_price: number | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          assigned_to?: string | null
          assignment_type?: string | null
          booking_date?: string | null
          commission_rate?: number | null
          completed_at?: string | null
          contact_person_id?: string | null
          created_at?: string
          created_by?: string | null
          economy_note?: string | null
          email?: string | null
          external_id?: string | null
          foreman_name?: string | null
          id?: string
          invoice_due_date?: string | null
          invoiced?: boolean
          invoiced_at?: string | null
          job_type?: Database["public"]["Enums"]["job_type"]
          last_contact?: string | null
          lost_at?: string | null
          lost_competitor?: string | null
          lost_note?: string | null
          lost_reason?: Database["public"]["Enums"]["lost_reason"] | null
          material_cost?: number | null
          name: string
          needs_offer?: boolean
          next_action_at?: string | null
          next_action_note?: string | null
          notes?: string | null
          offer_accepted_at?: string | null
          offer_pdf_path?: string | null
          personal_number?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          price?: number | null
          property_id?: string | null
          rot_amount?: number | null
          rot_applied_at?: string | null
          rot_eligible?: boolean
          rot_paid?: boolean
          score?: number | null
          seller_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          subcontractor_name?: string | null
          subcontractor_price?: number | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          assigned_to?: string | null
          assignment_type?: string | null
          booking_date?: string | null
          commission_rate?: number | null
          completed_at?: string | null
          contact_person_id?: string | null
          created_at?: string
          created_by?: string | null
          economy_note?: string | null
          email?: string | null
          external_id?: string | null
          foreman_name?: string | null
          id?: string
          invoice_due_date?: string | null
          invoiced?: boolean
          invoiced_at?: string | null
          job_type?: Database["public"]["Enums"]["job_type"]
          last_contact?: string | null
          lost_at?: string | null
          lost_competitor?: string | null
          lost_note?: string | null
          lost_reason?: Database["public"]["Enums"]["lost_reason"] | null
          material_cost?: number | null
          name?: string
          needs_offer?: boolean
          next_action_at?: string | null
          next_action_note?: string | null
          notes?: string | null
          offer_accepted_at?: string | null
          offer_pdf_path?: string | null
          personal_number?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          price?: number | null
          property_id?: string | null
          rot_amount?: number | null
          rot_applied_at?: string | null
          rot_eligible?: boolean
          rot_paid?: boolean
          score?: number | null
          seller_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          subcontractor_name?: string | null
          subcontractor_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_drafts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          label: string
          lead_id: string | null
          payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          label?: string
          lead_id?: string | null
          payload?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          label?: string
          lead_id?: string | null
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_number_counters: {
        Row: {
          last_number: number
          updated_at: string
          year: number
        }
        Insert: {
          last_number?: number
          updated_at?: string
          year: number
        }
        Update: {
          last_number?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      offers: {
        Row: {
          accepted_at: string | null
          calculation_id: string | null
          created_at: string
          created_by: string
          id: string
          lead_id: string
          pdf_path: string
          sent_at: string | null
          status: Database["public"]["Enums"]["offer_status"]
          total_amount: number
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          calculation_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          pdf_path: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          total_amount?: number
          updated_at?: string
          version: number
        }
        Update: {
          accepted_at?: string | null
          calculation_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          pdf_path?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          total_amount?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list: {
        Row: {
          category: Database["public"]["Enums"]["price_category"]
          created_at: string
          id: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          unit: Database["public"]["Enums"]["price_unit"]
          unit_price: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["price_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
          unit: Database["public"]["Enums"]["price_unit"]
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["price_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          unit?: Database["public"]["Enums"]["price_unit"]
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          build_year: number | null
          created_at: string
          has_roof_permit: boolean
          id: string
          latitude: number | null
          longitude: number | null
          municipality: string
          property_designation: string | null
          region: string
          roof_age: number | null
          roof_type: string | null
          roof_wash_reason: string | null
          roof_wash_score: number | null
          updated_at: string
        }
        Insert: {
          address: string
          build_year?: number | null
          created_at?: string
          has_roof_permit?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipality: string
          property_designation?: string | null
          region: string
          roof_age?: number | null
          roof_type?: string | null
          roof_wash_reason?: string | null
          roof_wash_score?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          build_year?: number | null
          created_at?: string
          has_roof_permit?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipality?: string
          property_designation?: string | null
          region?: string
          roof_age?: number | null
          roof_type?: string | null
          roof_wash_reason?: string | null
          roof_wash_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      quick_price_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          kind: string
          label: string
          service: string
          sort_order: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          kind: string
          label: string
          service: string
          sort_order?: number
          unit: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          kind?: string
          label?: string
          service?: string
          sort_order?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      quick_price_settings: {
        Row: {
          created_at: string
          id: number
          moms_procent: number
          rot_procent: number
          rot_tak_per_agare: number
          taktvatt_min_pris: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          moms_procent?: number
          rot_procent?: number
          rot_tak_per_agare?: number
          taktvatt_min_pris?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          moms_procent?: number
          rot_procent?: number
          rot_tak_per_agare?: number
          taktvatt_min_pris?: number
          updated_at?: string
        }
        Relationships: []
      }
      salary_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          period_month: string
          reason: string
          type: Database["public"]["Enums"]["salary_adjustment_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          period_month: string
          reason: string
          type: Database["public"]["Enums"]["salary_adjustment_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          period_month?: string
          reason?: string
          type?: Database["public"]["Enums"]["salary_adjustment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "salary_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          avg_order_goal: number
          created_at: string
          created_by: string | null
          deals_goal: number
          id: string
          meetings_goal: number
          offers_goal: number
          period_month: string
          revenue_goal: number
          seller_id: string | null
          updated_at: string
          win_rate_goal: number
        }
        Insert: {
          avg_order_goal?: number
          created_at?: string
          created_by?: string | null
          deals_goal?: number
          id?: string
          meetings_goal?: number
          offers_goal?: number
          period_month: string
          revenue_goal?: number
          seller_id?: string | null
          updated_at?: string
          win_rate_goal?: number
        }
        Update: {
          avg_order_goal?: number
          created_at?: string
          created_by?: string | null
          deals_goal?: number
          id?: string
          meetings_goal?: number
          offers_goal?: number
          period_month?: string
          revenue_goal?: number
          seller_id?: string | null
          updated_at?: string
          win_rate_goal?: number
        }
        Relationships: []
      }
      self_check_deliveries: {
        Row: {
          attempt: number
          created_at: string
          embedded_image_count: number
          error_message: string | null
          id: string
          job_id: string
          pdf_path: string | null
          recipient_email: string | null
          self_check_id: string | null
          skipped_images: Json
          status: string
          template_key: string
          triggered_by: string | null
        }
        Insert: {
          attempt?: number
          created_at?: string
          embedded_image_count?: number
          error_message?: string | null
          id?: string
          job_id: string
          pdf_path?: string | null
          recipient_email?: string | null
          self_check_id?: string | null
          skipped_images?: Json
          status: string
          template_key: string
          triggered_by?: string | null
        }
        Update: {
          attempt?: number
          created_at?: string
          embedded_image_count?: number
          error_message?: string | null
          id?: string
          job_id?: string
          pdf_path?: string | null
          recipient_email?: string | null
          self_check_id?: string | null
          skipped_images?: Json
          status?: string
          template_key?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "self_check_deliveries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "self_check_deliveries_self_check_id_fkey"
            columns: ["self_check_id"]
            isOneToOne: false
            referencedRelation: "self_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      self_check_instructions: {
        Row: {
          created_at: string
          field_label: string | null
          id: string
          instruction: string
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          field_label?: string | null
          id?: string
          instruction?: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          field_label?: string | null
          id?: string
          instruction?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      self_checks: {
        Row: {
          completed_at: string | null
          created_at: string
          data: Json
          id: string
          job_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          template_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data?: Json
          id?: string
          job_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          template_key?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data?: Json
          id?: string
          job_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          template_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_checks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_competitors: {
        Row: {
          created_at: string
          domain: string
          id: string
          label: string | null
          notes: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          label?: string | null
          notes?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          label?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      seo_daily_metrics: {
        Row: {
          clicks: number
          created_at: string
          ctr: number
          dimension: string
          id: number
          impressions: number
          key1: string
          key2: string
          metric_date: string
          position: number
          site_url: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          ctr?: number
          dimension: string
          id?: number
          impressions?: number
          key1?: string
          key2?: string
          metric_date: string
          position?: number
          site_url: string
        }
        Update: {
          clicks?: number
          created_at?: string
          ctr?: number
          dimension?: string
          id?: number
          impressions?: number
          key1?: string
          key2?: string
          metric_date?: string
          position?: number
          site_url?: string
        }
        Relationships: []
      }
      seo_local_targets: {
        Row: {
          active: boolean
          created_at: string
          id: string
          landing_url: string | null
          locality: string
          service: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          landing_url?: string | null
          locality: string
          service: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          landing_url?: string | null
          locality?: string
          service?: string
        }
        Relationships: []
      }
      seo_page_audits: {
        Row: {
          canonical: string | null
          fetched_at: string
          h1: string[] | null
          headings: Json
          health_score: number | null
          html_bytes: number | null
          id: string
          images_missing_alt: number
          images_total: number
          in_sitemap: boolean
          internal_links_out: string[]
          issues: Json
          meta_description: string | null
          psi: Json | null
          robots: string | null
          status_code: number | null
          structured_data: string[]
          title: string | null
          url: string
          word_count: number | null
        }
        Insert: {
          canonical?: string | null
          fetched_at?: string
          h1?: string[] | null
          headings?: Json
          health_score?: number | null
          html_bytes?: number | null
          id?: string
          images_missing_alt?: number
          images_total?: number
          in_sitemap?: boolean
          internal_links_out?: string[]
          issues?: Json
          meta_description?: string | null
          psi?: Json | null
          robots?: string | null
          status_code?: number | null
          structured_data?: string[]
          title?: string | null
          url: string
          word_count?: number | null
        }
        Update: {
          canonical?: string | null
          fetched_at?: string
          h1?: string[] | null
          headings?: Json
          health_score?: number | null
          html_bytes?: number | null
          id?: string
          images_missing_alt?: number
          images_total?: number
          in_sitemap?: boolean
          internal_links_out?: string[]
          issues?: Json
          meta_description?: string | null
          psi?: Json | null
          robots?: string | null
          status_code?: number | null
          structured_data?: string[]
          title?: string | null
          url?: string
          word_count?: number | null
        }
        Relationships: []
      }
      seo_sync_log: {
        Row: {
          finished_at: string | null
          id: string
          message: string | null
          rows_written: number
          source: string
          started_at: string
          status: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          message?: string | null
          rows_written?: number
          source: string
          started_at?: string
          status: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          message?: string | null
          rows_written?: number
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      seo_tasks: {
        Row: {
          affected_url: string | null
          baseline: Json | null
          category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          difficulty: number
          id: string
          impact: number
          opportunity_score: number
          priority: string
          problem: string | null
          recommendation: string | null
          source: string
          source_key: string | null
          status: string
          target_keyword: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_url?: string | null
          baseline?: Json | null
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number
          id?: string
          impact?: number
          opportunity_score?: number
          priority?: string
          problem?: string | null
          recommendation?: string | null
          source?: string
          source_key?: string | null
          status?: string
          target_keyword?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_url?: string | null
          baseline?: Json | null
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number
          id?: string
          impact?: number
          opportunity_score?: number
          priority?: string
          problem?: string | null
          recommendation?: string | null
          source?: string
          source_key?: string | null
          status?: string
          target_keyword?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      signature_requests: {
        Row: {
          base_pdf_path: string
          company_date: string
          company_place: string
          company_signature_png: string
          company_signed_at: string
          company_signer_name: string
          created_at: string
          created_by: string
          customer_date: string | null
          customer_email: string
          customer_ip: string | null
          customer_name: string
          customer_place: string | null
          customer_signature_png: string | null
          customer_signed_at: string | null
          customer_signer_name: string | null
          customer_user_agent: string | null
          expires_at: string
          id: string
          lead_id: string | null
          offer_number: string
          otp_attempts: number
          otp_code_hash: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          sent_at: string | null
          signed_pdf_path: string | null
          status: string
          token: string
          total_amount: number | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          base_pdf_path: string
          company_date: string
          company_place: string
          company_signature_png: string
          company_signed_at?: string
          company_signer_name: string
          created_at?: string
          created_by: string
          customer_date?: string | null
          customer_email: string
          customer_ip?: string | null
          customer_name: string
          customer_place?: string | null
          customer_signature_png?: string | null
          customer_signed_at?: string | null
          customer_signer_name?: string | null
          customer_user_agent?: string | null
          expires_at?: string
          id?: string
          lead_id?: string | null
          offer_number: string
          otp_attempts?: number
          otp_code_hash?: string | null
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          sent_at?: string | null
          signed_pdf_path?: string | null
          status?: string
          token: string
          total_amount?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          base_pdf_path?: string
          company_date?: string
          company_place?: string
          company_signature_png?: string
          company_signed_at?: string
          company_signer_name?: string
          created_at?: string
          created_by?: string
          customer_date?: string | null
          customer_email?: string
          customer_ip?: string | null
          customer_name?: string
          customer_place?: string | null
          customer_signature_png?: string | null
          customer_signed_at?: string | null
          customer_signer_name?: string | null
          customer_user_agent?: string | null
          expires_at?: string
          id?: string
          lead_id?: string | null
          offer_number?: string
          otp_attempts?: number
          otp_code_hash?: string | null
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          sent_at?: string | null
          signed_pdf_path?: string | null
          status?: string
          token?: string
          total_amount?: number | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          hours: number
          id: string
          job_id: string
          status: Database["public"]["Enums"]["time_entry_status"]
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          hours: number
          id?: string
          job_id: string
          status?: Database["public"]["Enums"]["time_entry_status"]
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          job_id?: string
          status?: Database["public"]["Enums"]["time_entry_status"]
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
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
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          headers: Json | null
          id: string
          lead_id: string | null
          payload: Json | null
          source: string
          status: string
          status_code: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          headers?: Json | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          source?: string
          status: string
          status_code: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          headers?: Json | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          source?: string
          status?: string
          status_code?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_calendar_event: { Args: { _event_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      list_users_with_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: {
          display_name: string
          email: string
          id: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      peek_offer_number: { Args: never; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reserve_offer_number: { Args: never; Returns: string }
      schedule_booking_reminders: {
        Args: { _lead_id: string }
        Returns: undefined
      }
    }
    Enums: {
      activity_type:
        | "created"
        | "stage_change"
        | "status_change"
        | "assignment"
        | "note"
        | "call"
        | "pitch_generated"
        | "updated"
      app_role:
        | "admin"
        | "saljare"
        | "viewer"
        | "arbetsledare"
        | "hantverkare"
        | "underentreprenor"
        | "ekonomi"
      employment_type:
        | "timanstalld"
        | "fast"
        | "underentreprenor"
        | "provisionsbaserad"
        | "saljare_fast"
      job_assignment_type: "arbetsledare" | "underentreprenor"
      job_status: "ej_paborjad" | "pagaende" | "klar"
      job_type: "roof_replacement" | "roof_cleaning" | "light_roof_work"
      lead_source:
        | "field"
        | "telemarketing"
        | "scan"
        | "referral"
        | "csv_import"
        | "roslagstak"
      lead_status: "cold" | "warm" | "hot" | "customer" | "lost"
      lost_reason:
        | "for_dyrt"
        | "konkurrent"
        | "kunden_avvaktar"
        | "ingen_finansiering"
        | "svarar_inte"
        | "projektet_installt"
        | "annan_losning"
        | "dalig_timing"
        | "annat"
      offer_status: "draft" | "skickad" | "accepterad" | "avvisad"
      pipeline_stage:
        | "inkommande_webb"
        | "saljpanel"
        | "offererad"
        | "bokad"
        | "pagaende"
        | "slutford"
        | "kontaktad"
        | "mote_genomfort"
        | "offert_skickad"
        | "uppfoljning"
        | "forhandling"
        | "forlorad"
        | "mote_bokat"
      price_category: "material" | "arbete" | "plat" | "tillagg"
      price_unit: "kvm" | "meter" | "st" | "timme" | "paket"
      salary_adjustment_type: "tillagg" | "avdrag"
      time_entry_status: "pending" | "approved" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activity_type: [
        "created",
        "stage_change",
        "status_change",
        "assignment",
        "note",
        "call",
        "pitch_generated",
        "updated",
      ],
      app_role: [
        "admin",
        "saljare",
        "viewer",
        "arbetsledare",
        "hantverkare",
        "underentreprenor",
        "ekonomi",
      ],
      employment_type: [
        "timanstalld",
        "fast",
        "underentreprenor",
        "provisionsbaserad",
        "saljare_fast",
      ],
      job_assignment_type: ["arbetsledare", "underentreprenor"],
      job_status: ["ej_paborjad", "pagaende", "klar"],
      job_type: ["roof_replacement", "roof_cleaning", "light_roof_work"],
      lead_source: [
        "field",
        "telemarketing",
        "scan",
        "referral",
        "csv_import",
        "roslagstak",
      ],
      lead_status: ["cold", "warm", "hot", "customer", "lost"],
      lost_reason: [
        "for_dyrt",
        "konkurrent",
        "kunden_avvaktar",
        "ingen_finansiering",
        "svarar_inte",
        "projektet_installt",
        "annan_losning",
        "dalig_timing",
        "annat",
      ],
      offer_status: ["draft", "skickad", "accepterad", "avvisad"],
      pipeline_stage: [
        "inkommande_webb",
        "saljpanel",
        "offererad",
        "bokad",
        "pagaende",
        "slutford",
        "kontaktad",
        "mote_genomfort",
        "offert_skickad",
        "uppfoljning",
        "forhandling",
        "forlorad",
        "mote_bokat",
      ],
      price_category: ["material", "arbete", "plat", "tillagg"],
      price_unit: ["kvm", "meter", "st", "timme", "paket"],
      salary_adjustment_type: ["tillagg", "avdrag"],
      time_entry_status: ["pending", "approved", "rejected"],
    },
  },
} as const
