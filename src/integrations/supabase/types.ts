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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      departments: {
        Row: { active: boolean; code: string; created_at: string; id: string; name_en: string; name_ru: string; name_uz: string; panel: string; sort_order: number }
        Insert: { active?: boolean; code: string; created_at?: string; id?: string; name_en?: string; name_ru?: string; name_uz: string; panel: string; sort_order?: number }
        Update: { active?: boolean; code?: string; created_at?: string; id?: string; name_en?: string; name_ru?: string; name_uz?: string; panel?: string; sort_order?: number }
        Relationships: []
      }
      employees: {
        Row: { active: boolean; created_at: string; email: string | null; full_name: string; hired_at: string; id: string; note: string | null; phone: string | null; position_id: string | null; updated_at: string; user_id: string | null }
        Insert: { active?: boolean; created_at?: string; email?: string | null; full_name: string; hired_at?: string; id?: string; note?: string | null; phone?: string | null; position_id?: string | null; updated_at?: string; user_id?: string | null }
        Update: { active?: boolean; created_at?: string; email?: string | null; full_name?: string; hired_at?: string; id?: string; note?: string | null; phone?: string | null; position_id?: string | null; updated_at?: string; user_id?: string | null }
        Relationships: [
          { foreignKeyName: "employees_position_id_fkey"; columns: ["position_id"]; isOneToOne: false; referencedRelation: "positions"; referencedColumns: ["id"] },
        ]
      }
      positions: {
        Row: { active: boolean; code: string; created_at: string; department_id: string; headcount: number; id: string; permissions: string[]; sort_order: number; title_ru: string; title_uz: string }
        Insert: { active?: boolean; code: string; created_at?: string; department_id: string; headcount?: number; id?: string; permissions?: string[]; sort_order?: number; title_ru?: string; title_uz: string }
        Update: { active?: boolean; code?: string; created_at?: string; department_id?: string; headcount?: number; id?: string; permissions?: string[]; sort_order?: number; title_ru?: string; title_uz?: string }
        Relationships: [
          { foreignKeyName: "positions_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
        ]
      }
      leads: {
        Row: { amount: number; created_at: string; id: string; loss_reason: string | null; name: string; next_action_at: string | null; note: string | null; operator_id: string | null; order_id: string | null; phone: string; source_id: string | null; status: string; updated_at: string }
        Insert: { amount?: number; created_at?: string; id?: string; loss_reason?: string | null; name: string; next_action_at?: string | null; note?: string | null; operator_id?: string | null; order_id?: string | null; phone: string; source_id?: string | null; status?: string; updated_at?: string }
        Update: { amount?: number; created_at?: string; id?: string; loss_reason?: string | null; name?: string; next_action_at?: string | null; note?: string | null; operator_id?: string | null; order_id?: string | null; phone?: string; source_id?: string | null; status?: string; updated_at?: string }
        Relationships: []
      }
      lead_events: {
        Row: { created_at: string; duration_sec: number | null; happened_at: string; id: string; kind: string; lead_id: string; note: string | null; operator_id: string | null; outcome: string | null }
        Insert: { created_at?: string; duration_sec?: number | null; happened_at?: string; id?: string; kind: string; lead_id: string; note?: string | null; operator_id?: string | null; outcome?: string | null }
        Update: { created_at?: string; duration_sec?: number | null; happened_at?: string; id?: string; kind?: string; lead_id?: string; note?: string | null; operator_id?: string | null; outcome?: string | null }
        Relationships: []
      }
      lead_sources: {
        Row: { active: boolean; created_at: string; id: string; name: string; sort_order: number }
        Insert: { active?: boolean; created_at?: string; id?: string; name: string; sort_order?: number }
        Update: { active?: boolean; created_at?: string; id?: string; name?: string; sort_order?: number }
        Relationships: []
      }
      sales_operators: {
        Row: { active: boolean; color: string; created_at: string; id: string; name: string; phone: string | null; updated_at: string }
        Insert: { active?: boolean; color?: string; created_at?: string; id?: string; name: string; phone?: string | null; updated_at?: string }
        Update: { active?: boolean; color?: string; created_at?: string; id?: string; name?: string; phone?: string | null; updated_at?: string }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          ok: boolean
          order_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          ok: boolean
          order_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          ok?: boolean
          order_id?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          active: boolean
          created_at: string
          email: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: { amount: number; created_at: string; id: string; kind: string; note: string | null; order_id: string | null; session_id: string }
        Insert: { amount: number; created_at?: string; id?: string; kind: string; note?: string | null; order_id?: string | null; session_id: string }
        Update: { amount?: number; created_at?: string; id?: string; kind?: string; note?: string | null; order_id?: string | null; session_id?: string }
        Relationships: []
      }
      cash_sessions: {
        Row: { closed_at: string | null; counted_cash: number | null; created_at: string; department_id: string | null; employee_id: string; id: string; note: string | null; opened_at: string; opening_float: number }
        Insert: { closed_at?: string | null; counted_cash?: number | null; created_at?: string; department_id?: string | null; employee_id: string; id?: string; note?: string | null; opened_at?: string; opening_float?: number }
        Update: { closed_at?: string | null; counted_cash?: number | null; created_at?: string; department_id?: string | null; employee_id?: string; id?: string; note?: string | null; opened_at?: string; opening_float?: number }
        Relationships: []
      }
      finance_entries: {
        Row: { amount: number; category: string; created_at: string; created_by: string | null; happened_on: string; id: string; kind: string; note: string | null }
        Insert: { amount: number; category: string; created_at?: string; created_by?: string | null; happened_on?: string; id?: string; kind: string; note?: string | null }
        Update: { amount?: number; category?: string; created_at?: string; created_by?: string | null; happened_on?: string; id?: string; kind?: string; note?: string | null }
        Relationships: []
      }
      shifts: {
        Row: { created_at: string; department_id: string | null; employee_id: string; ended_at: string | null; id: string; note: string | null; started_at: string }
        Insert: { created_at?: string; department_id?: string | null; employee_id: string; ended_at?: string | null; id?: string; note?: string | null; started_at?: string }
        Update: { created_at?: string; department_id?: string | null; employee_id?: string; ended_at?: string | null; id?: string; note?: string | null; started_at?: string }
        Relationships: []
      }
      supply_items: {
        Row: { created_at: string; id: string; product_id: string | null; quantity: number; supply_order_id: string; title: string; unit_cost: number; variant_id: string | null }
        Insert: { created_at?: string; id?: string; product_id?: string | null; quantity?: number; supply_order_id: string; title: string; unit_cost?: number; variant_id?: string | null }
        Update: { created_at?: string; id?: string; product_id?: string | null; quantity?: number; supply_order_id?: string; title?: string; unit_cost?: number; variant_id?: string | null }
        Relationships: []
      }
      supply_orders: {
        Row: { created_at: string; created_by: string | null; expected_on: string | null; id: string; note: string | null; received_on: string | null; status: string; supplier: string; total: number; updated_at: string }
        Insert: { created_at?: string; created_by?: string | null; expected_on?: string | null; id?: string; note?: string | null; received_on?: string | null; status?: string; supplier: string; total?: number; updated_at?: string }
        Update: { created_at?: string; created_by?: string | null; expected_on?: string | null; id?: string; note?: string | null; received_on?: string | null; status?: string; supplier?: string; total?: number; updated_at?: string }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string | null
          name_en: string
          name_ru: string
          name_uz: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string | null
          name_en: string
          name_ru?: string
          name_uz?: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string | null
          name_en?: string
          name_ru?: string
          name_uz?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          id: string
          image_url: string | null
          order_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          size: string | null
          variant_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          order_id: string
          price?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          size?: string | null
          variant_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          order_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          created_at: string
          customer_name: string
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          note: string | null
          order_number: string
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payment_status: string
          phone: string
          shipping: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          customer_name: string
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          order_number: string
          payment_method?: string
          payment_provider?: string
          payment_ref?: string | null
          payment_status?: string
          phone: string
          shipping?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          customer_name?: string
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          order_number?: string
          payment_method?: string
          payment_provider?: string
          payment_ref?: string | null
          payment_status?: string
          phone?: string
          shipping?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      payme_transactions: {
        Row: {
          amount: number
          cancel_time: number
          create_time: number
          created_at: string
          id: string
          order_id: string
          perform_time: number
          reason: number | null
          state: number
        }
        Insert: {
          amount: number
          cancel_time?: number
          create_time: number
          created_at?: string
          id: string
          order_id: string
          perform_time?: number
          reason?: number | null
          state?: number
        }
        Update: {
          amount?: number
          cancel_time?: number
          create_time?: number
          created_at?: string
          id?: string
          order_id?: string
          perform_time?: number
          reason?: number | null
          state?: number
        }
        Relationships: [
          {
            foreignKeyName: "payme_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string
          created_at: string
          id: string
          product_id: string
          size: string
          stock: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          product_id: string
          size?: string
          stock?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          product_id?: string
          size?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category_id: string | null
          colors: string[]
          compare_price: number | null
          created_at: string
          description: string
          description_ru: string
          description_uz: string
          featured: boolean
          id: string
          images: string[]
          name: string
          name_ru: string
          name_uz: string
          price: number
          sizes: string[]
          slug: string
          sold_count: number
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          colors?: string[]
          compare_price?: number | null
          created_at?: string
          description?: string
          description_ru?: string
          description_uz?: string
          featured?: boolean
          id?: string
          images?: string[]
          name: string
          name_ru?: string
          name_uz?: string
          price?: number
          sizes?: string[]
          slug: string
          sold_count?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          colors?: string[]
          compare_price?: number | null
          created_at?: string
          description?: string
          description_ru?: string
          description_uz?: string
          featured?: boolean
          id?: string
          images?: string[]
          name?: string
          name_ru?: string
          name_uz?: string
          price?: number
          sizes?: string[]
          slug?: string
          sold_count?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      translations: {
        Row: {
          en: string
          key: string
          ru: string
          updated_at: string
          uz: string
        }
        Insert: {
          en?: string
          key: string
          ru?: string
          updated_at?: string
          uz?: string
        }
        Update: {
          en?: string
          key?: string
          ru?: string
          updated_at?: string
          uz?: string
        }
        Relationships: []
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
      cash_expected: { Args: { p_session: string }; Returns: number }
      receive_supply_order: { Args: { p_id: string }; Returns: Json }
      claim_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_order_number: { Args: never; Returns: string }
      cancel_stale_orders: {
        Args: { p_older_than_hours?: number }
        Returns: number
      }
      telegram_test: {
        Args: never
        Returns: Json
      }
      track_order: {
        Args: { p_order_number: string; p_phone: string }
        Returns: Json
      }
      shipping_for: {
        Args: { p_subtotal: number }
        Returns: number
      }
      submit_contact_message: {
        Args: { p_email: string; p_message: string; p_name: string }
        Returns: boolean
      }
      subscribe_newsletter: {
        Args: { p_email: string }
        Returns: boolean
      }
      has_permission: { Args: { p_code: string }; Returns: boolean }
      my_profile: { Args: never; Returns: Json }
      list_team: {
        Args: never
        Returns: {
          email: string
          id: string
          joined_at: string
          roles: string[]
        }[]
      }
      set_product_variants: {
        Args: { p_product_id: string; p_variants: Json }
        Returns: number
      }
      set_user_role: {
        Args: {
          p_email: string
          p_enabled: boolean
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      payment_config: { Args: never; Returns: Json }
      payme_rpc: { Args: { p_auth: string; p_body: Json }; Returns: Json }
      place_order_payme: {
        Args: {
          p_address: string
          p_customer_name: string
          p_email: string
          p_items: Json
          p_lat: number
          p_lng: number
          p_note: string
          p_phone: string
        }
        Returns: Json
      }
      place_order: {
        Args: {
          p_address: string
          p_card_last4: string
          p_customer_name: string
          p_email: string
          p_items: Json
          p_lat: number
          p_lng: number
          p_note: string
          p_payment_method?: string
          p_phone: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
