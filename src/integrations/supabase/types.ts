export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      guest_registrations: {
        Row: {
          created_at: string
          guest_email: string | null
          guest_name: string
          id: string
          registration_id: string
        }
        Insert: {
          created_at?: string
          guest_email?: string | null
          guest_name: string
          id?: string
          registration_id: string
        }
        Update: {
          created_at?: string
          guest_email?: string | null
          guest_name?: string
          id?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_registrations_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      invited_guests: {
        Row: {
          created_at: string
          email: string
          id: string
          max_guests: number
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          max_guests?: number
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          max_guests?: number
          name?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          id: string
          invited_guest_id: string
          last_modified_at: string | null
          modified_after_initial: boolean | null
          registered_at: string
          will_attend: boolean | null
        }
        Insert: {
          id?: string
          invited_guest_id: string
          last_modified_at?: string | null
          modified_after_initial?: boolean | null
          registered_at?: string
          will_attend?: boolean | null
        }
        Update: {
          id?: string
          invited_guest_id?: string
          last_modified_at?: string | null
          modified_after_initial?: boolean | null
          registered_at?: string
          will_attend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_invited_guest_id_fkey"
            columns: ["invited_guest_id"]
            isOneToOne: false
            referencedRelation: "invited_guests"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvp_settings: {
        Row: {
          created_at: string
          id: string
          is_open: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_open?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_open?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      seat_assignments: {
        Row: {
          created_at: string
          guest_name: string | null
          id: string
          note: string | null
          seat_angle: number
          seat_index: number
          table_configuration_id: string
          tag: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_name?: string | null
          id?: string
          note?: string | null
          seat_angle: number
          seat_index: number
          table_configuration_id: string
          tag?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_name?: string | null
          id?: string
          note?: string | null
          seat_angle?: number
          seat_index?: number
          table_configuration_id?: string
          tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_assignments_table_configuration_id_fkey"
            columns: ["table_configuration_id"]
            isOneToOne: false
            referencedRelation: "table_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      table_configurations: {
        Row: {
          created_at: string
          id: string
          label: string
          seat_count: number
          table_number: number
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          seat_count?: number
          table_number: number
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          seat_count?: number
          table_number?: number
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_valid_guest_or_admin: {
        Args: { check_email: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
