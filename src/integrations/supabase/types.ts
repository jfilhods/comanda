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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          position: number
          restaurant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          position?: number
          restaurant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          position?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string
          notes: string | null
          phone: string | null
          status: string
          trade_name: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name: string
          notes?: string | null
          phone?: string | null
          status?: string
          trade_name?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          trade_name?: string | null
        }
        Relationships: []
      }
      dining_tables: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          label: string
          restaurant_id: string
          status: Database["public"]["Enums"]["table_status"]
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          label: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["table_status"]
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          label?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["table_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          order_id: string
          reason: string | null
          restaurant_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id: string
          reason?: string | null
          restaurant_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id?: string
          reason?: string | null
          restaurant_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          unit_price?: number
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
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          id: string
          notes: string | null
          number: number
          previous_status: Database["public"]["Enums"]["order_status"] | null
          restaurant_id: string
          session_id: string
          status: Database["public"]["Enums"]["order_status"]
          table_id: string
          total: number
          updated_at: string
          waiter_id: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          number?: never
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          restaurant_id: string
          session_id: string
          status?: Database["public"]["Enums"]["order_status"]
          table_id: string
          total?: number
          updated_at?: string
          waiter_id: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          number?: never
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          restaurant_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string
          total?: number
          updated_at?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          available: boolean
          category_id: string | null
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          prep_minutes: number | null
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          available?: boolean
          category_id?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          prep_minutes?: number | null
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          available?: boolean
          category_id?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          prep_minutes?: number | null
          price?: number
          restaurant_id?: string
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
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      restaurant_members: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          phone: string | null
          slug: string | null
          status: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          phone?: string | null
          slug?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          phone?: string | null
          slug?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          amount_paid: number | null
          closed_at: string | null
          closed_by: string | null
          id: string
          opened_at: string
          opened_by: string | null
          payment_method: string | null
          restaurant_id: string
          status: string
          table_id: string
        }
        Insert: {
          amount_paid?: number | null
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          payment_method?: string | null
          restaurant_id: string
          status?: string
          table_id: string
        }
        Update: {
          amount_paid?: number | null
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          payment_method?: string | null
          restaurant_id?: string
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      close_session: {
        Args: { _payment_method: string; _session_id: string }
        Returns: number
      }
      create_order: {
        Args: { _items: Json; _notes?: string; _table_id: string }
        Returns: string
      }
      has_restaurant_role: {
        Args: {
          _rid: string
          _roles: Database["public"]["Enums"]["staff_role"][]
          _uid: string
        }
        Returns: boolean
      }
      is_global_admin: { Args: { _uid: string }; Returns: boolean }
      is_restaurant_member: {
        Args: { _rid: string; _uid: string }
        Returns: boolean
      }
      request_bill: { Args: { _table_id: string }; Returns: undefined }
      set_order_status: {
        Args: {
          _order_id: string
          _reason?: string
          _to: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "global_admin"
      order_status:
        | "novo"
        | "aceito"
        | "em_preparo"
        | "pronto"
        | "entregue"
        | "cancelamento_solicitado"
        | "cancelado"
      staff_role: "gerente" | "garcom" | "cozinha"
      table_status:
        | "livre"
        | "ocupada"
        | "aguardando_pagamento"
        | "em_encerramento"
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
      app_role: ["global_admin"],
      order_status: [
        "novo",
        "aceito",
        "em_preparo",
        "pronto",
        "entregue",
        "cancelamento_solicitado",
        "cancelado",
      ],
      staff_role: ["gerente", "garcom", "cozinha"],
      table_status: [
        "livre",
        "ocupada",
        "aguardando_pagamento",
        "em_encerramento",
      ],
    },
  },
} as const
