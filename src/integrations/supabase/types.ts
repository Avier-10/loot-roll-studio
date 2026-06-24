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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          target_id: string | null
          target_table: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string | null
          target_table?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string | null
          target_table?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          id: string
          is_active: boolean
          suggested_at: string | null
          suggested_by_username: string | null
          title: string
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["item_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          id?: string
          is_active?: boolean
          suggested_at?: string | null
          suggested_by_username?: string | null
          title: string
          type: Database["public"]["Enums"]["item_type"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          suggested_at?: string | null
          suggested_by_username?: string | null
          title?: string
          type?: Database["public"]["Enums"]["item_type"]
          updated_at?: string
        }
        Relationships: []
      }
      pending_submissions: {
        Row: {
          approved_item_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          kick_username: string
          proposed_category: Database["public"]["Enums"]["item_category"] | null
          proposed_description: string | null
          proposed_title: string | null
          proposed_type: Database["public"]["Enums"]["item_type"] | null
          raw_message: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
        }
        Insert: {
          approved_item_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kick_username: string
          proposed_category?:
            | Database["public"]["Enums"]["item_category"]
            | null
          proposed_description?: string | null
          proposed_title?: string | null
          proposed_type?: Database["public"]["Enums"]["item_type"] | null
          raw_message: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
        }
        Update: {
          approved_item_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kick_username?: string
          proposed_category?:
            | Database["public"]["Enums"]["item_category"]
            | null
          proposed_description?: string | null
          proposed_title?: string | null
          proposed_type?: Database["public"]["Enums"]["item_type"] | null
          raw_message?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_submissions_approved_item_id_fkey"
            columns: ["approved_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      probability_versions: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          restored_from_version: number | null
          version: number
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          restored_from_version?: number | null
          version: number
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          restored_from_version?: number | null
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          active_spin_id: string | null
          active_spin_started_at: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          pending_spin_id: string | null
          updated_at: string
          username: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          active_spin_id?: string | null
          active_spin_started_at?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_active?: boolean
          pending_spin_id?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          active_spin_id?: string | null
          active_spin_started_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          pending_spin_id?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      spins: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          item_id: string | null
          item_snapshot: Json
          spun_by: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          item_id?: string | null
          item_snapshot: Json
          spun_by?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          item_id?: string | null
          item_snapshot?: Json
          spun_by?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spins_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
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
      acquire_spin_lock: {
        Args: { _spin_id: string; _uid: string }
        Returns: boolean
      }
      clear_pending_spin: { Args: { _uid: string }; Returns: undefined }
      get_account_status: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["account_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_active: { Args: { _uid: string }; Returns: boolean }
      release_spin_lock: {
        Args: { _pending_spin_id: string; _uid: string }
        Returns: undefined
      }
      write_audit: {
        Args: {
          _action: string
          _actor: string
          _metadata: Json
          _new: Json
          _old: Json
          _target_id: string
          _target_table: string
          _target_type: string
        }
        Returns: string
      }
    }
    Enums: {
      account_status: "pendiente" | "activo" | "suspendido" | "deshabilitado"
      app_role: "admin" | "streamer" | "moderator"
      item_category:
        | "bueno"
        | "muy_bueno"
        | "excelente"
        | "leve"
        | "medio"
        | "fuerte"
      item_type: "beneficio" | "castigo"
      submission_status: "pendiente" | "aprobado" | "rechazado"
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
      account_status: ["pendiente", "activo", "suspendido", "deshabilitado"],
      app_role: ["admin", "streamer", "moderator"],
      item_category: [
        "bueno",
        "muy_bueno",
        "excelente",
        "leve",
        "medio",
        "fuerte",
      ],
      item_type: ["beneficio", "castigo"],
      submission_status: ["pendiente", "aprobado", "rechazado"],
    },
  },
} as const
