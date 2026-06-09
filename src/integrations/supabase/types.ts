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
          created_at: string
          created_by: string | null
          email: string | null
          external_id: string | null
          foreman_name: string | null
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          last_contact: string | null
          name: string
          needs_offer: boolean
          notes: string | null
          offer_pdf_path: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          price: number | null
          property_id: string | null
          rot_amount: number | null
          rot_paid: boolean
          score: number | null
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
          created_at?: string
          created_by?: string | null
          email?: string | null
          external_id?: string | null
          foreman_name?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          last_contact?: string | null
          name: string
          needs_offer?: boolean
          notes?: string | null
          offer_pdf_path?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          price?: number | null
          property_id?: string | null
          rot_amount?: number | null
          rot_paid?: boolean
          score?: number | null
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
          created_at?: string
          created_by?: string | null
          email?: string | null
          external_id?: string | null
          foreman_name?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          last_contact?: string | null
          name?: string
          needs_offer?: boolean
          notes?: string | null
          offer_pdf_path?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          price?: number | null
          property_id?: string | null
          rot_amount?: number | null
          rot_paid?: boolean
          score?: number | null
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
      employment_type: "timanstalld" | "fast" | "underentreprenor"
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
      pipeline_stage:
        | "inkommande_webb"
        | "saljpanel"
        | "offererad"
        | "bokad"
        | "pagaende"
        | "slutford"
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
      ],
      employment_type: ["timanstalld", "fast", "underentreprenor"],
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
      pipeline_stage: [
        "inkommande_webb",
        "saljpanel",
        "offererad",
        "bokad",
        "pagaende",
        "slutford",
      ],
      salary_adjustment_type: ["tillagg", "avdrag"],
      time_entry_status: ["pending", "approved", "rejected"],
    },
  },
} as const
