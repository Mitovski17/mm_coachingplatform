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
      exercises: {
        Row: {
          created_at: string
          equipment: string
          id: string
          muscle_group: string
          name: string
        }
        Insert: {
          created_at?: string
          equipment: string
          id?: string
          muscle_group: string
          name: string
        }
        Update: {
          created_at?: string
          equipment?: string
          id?: string
          muscle_group?: string
          name?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          client_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          name: string
          notes: string | null
          performed_at: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          name?: string
          notes?: string | null
          performed_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          name?: string
          notes?: string | null
          performed_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          reps: number | null
          rpe: number | null
          session_id: string
          set_number: number
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_number?: number
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_number?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          calories: number | null
          carbs_g: number | null
          client_id: string
          created_at: string
          fat_g: number | null
          food_name: string
          id: string
          logged_date: string
          meal_type: string
          protein_g: number | null
          quantity: number | null
          unit: string | null
          workspace_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          client_id: string
          created_at?: string
          fat_g?: number | null
          food_name: string
          id?: string
          logged_date?: string
          meal_type: string
          protein_g?: number | null
          quantity?: number | null
          unit?: string | null
          workspace_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          client_id?: string
          created_at?: string
          fat_g?: number | null
          food_name?: string
          id?: string
          logged_date?: string
          meal_type?: string
          protein_g?: number | null
          quantity?: number | null
          unit?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activity_level: string | null
          coach_id: string | null
          created_at: string
          current_weight: number | null
          current_weight_unit: string | null
          desired_weight: number | null
          desired_weight_unit: string | null
          email: string
          foods_to_avoid: string | null
          full_name: string
          goal: string | null
          health_notes: string | null
          id: string
          meals_per_day: number | null
          notes: string | null
          occupation_notes: string | null
          onboarding_completed_at: string | null
          phone: string | null
          preferred_training_time: string | null
          status: string
          training_days_per_week: number | null
          training_location: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activity_level?: string | null
          coach_id?: string | null
          created_at?: string
          current_weight?: number | null
          current_weight_unit?: string | null
          desired_weight?: number | null
          desired_weight_unit?: string | null
          email: string
          foods_to_avoid?: string | null
          full_name: string
          goal?: string | null
          health_notes?: string | null
          id?: string
          meals_per_day?: number | null
          notes?: string | null
          occupation_notes?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          preferred_training_time?: string | null
          status?: string
          training_days_per_week?: number | null
          training_location?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activity_level?: string | null
          coach_id?: string | null
          created_at?: string
          current_weight?: number | null
          current_weight_unit?: string | null
          desired_weight?: number | null
          desired_weight_unit?: string | null
          email?: string
          foods_to_avoid?: string | null
          full_name?: string
          goal?: string | null
          health_notes?: string | null
          id?: string
          meals_per_day?: number | null
          notes?: string | null
          occupation_notes?: string | null
          onboarding_completed_at?: string | null
          phone?: string | null
          preferred_training_time?: string | null
          status?: string
          training_days_per_week?: number | null
          training_location?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          questions: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          questions?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          questions?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          answers: Json
          client_id: string
          coach_notes: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          status: string
          template_id: string | null
          updated_at: string
          week_start_date: string
          workspace_id: string
        }
        Insert: {
          answers?: Json
          client_id: string
          coach_notes?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          week_start_date: string
          workspace_id: string
        }
        Update: {
          answers?: Json
          client_id?: string
          coach_notes?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          week_start_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checkin_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      workout_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          rest_seconds: number
          sort_order: number
          target_reps: string
          target_sets: number
          template_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          rest_seconds?: number
          sort_order?: number
          target_reps?: string
          target_sets?: number
          template_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          rest_seconds?: number
          sort_order?: number
          target_reps?: string
          target_sets?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_programs: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_programs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_programs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_program_days: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          program_id: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          program_id: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          program_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_program_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "workout_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_program_days_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_workspace_id: { Args: never; Returns: string }
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
