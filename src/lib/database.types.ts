// Generated from the Supabase project schema (supabase gen types), trimmed of
// unused helper generics. Regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type E = Database["public"]["Enums"];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      customer_documents: {
        Row: { customer_id: string; doc_type: string; id: string; storage_path: string; uploaded_at: string };
        Insert: { customer_id: string; doc_type: string; id?: string; storage_path: string; uploaded_at?: string };
        Update: { customer_id?: string; doc_type?: string; id?: string; storage_path?: string; uploaded_at?: string };
        Relationships: [];
      };
      customers: {
        Row: {
          address_line: string | null; age_verified_at: string | null; approved_at: string | null;
          approved_by: string | null; auth_user_id: string | null; business_name: string | null;
          city: string | null; contact_name: string; created_at: string; created_by_staff: string | null;
          default_discount_kind: E["discount_kind"] | null; default_discount_value: number | null;
          email: string | null; id: string; kind: E["customer_kind"]; latitude: number | null;
          license_expires_on: string | null; liquor_license_no: string | null; longitude: number | null;
          notes: string | null; phone: string | null; postal_code: string | null; state: string | null;
          status: E["account_status"]; tax_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & { contact_name: string; kind: E["customer_kind"] };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      delivery_trips: {
        Row: {
          created_at: string; departed_at: string | null; driver_id: string | null; id: string;
          status: E["trip_status"]; trip_date: string; trip_number: number;
        };
        Insert: Partial<Database["public"]["Tables"]["delivery_trips"]["Row"]> & { trip_date: string };
        Update: Partial<Database["public"]["Tables"]["delivery_trips"]["Row"]>;
        Relationships: [];
      };
      locations: {
        Row: {
          catalog: E["catalog_kind"]; id: string; kind: E["location_kind"]; map_x: number | null;
          map_y: number | null; name: string; sort_order: number;
        };
        Insert: {
          catalog: E["catalog_kind"]; id?: string; kind: E["location_kind"]; map_x?: number | null;
          map_y?: number | null; name: string; sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["locations"]["Row"]>;
        Relationships: [];
      };
      order_lines: {
        Row: {
          confirmed_qty: number | null; id: string; order_id: string; pack_size_id: string | null;
          product_id: string; requested_at: string; requested_qty: number; staff_note: string | null;
          status: E["line_status"]; unit_price: number;
        };
        Insert: Partial<Database["public"]["Tables"]["order_lines"]["Row"]> & {
          order_id: string; product_id: string; requested_qty: number; unit_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_lines"]["Row"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          channel: E["order_channel"]; customer_id: string; customer_kind: E["customer_kind"];
          delivered_at: string | null; delivery_status: E["delivery_status"];
          discount_kind: E["discount_kind"] | null; discount_value: number | null; empties_count: number;
          empties_credit: number; entered_by_staff: string | null; fulfillment_date: string; has_ice: boolean;
          id: string; notes: string | null; order_number: number; payment_status: E["payment_status"];
          placed_at: string; status: E["order_status"]; stop_number: number | null; subtotal: number;
          total: number; trip_id: string | null; unpaid_signature_path: string | null;
          unpaid_signer_name: string | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["orders"]["Row"], "order_number">> & {
          channel: E["order_channel"]; customer_id: string; customer_kind: E["customer_kind"]; fulfillment_date: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["orders"]["Row"], "order_number">>;
        Relationships: [];
      };
      pack_sizes: {
        Row: {
          barcode: string | null; card_price: number; cash_price: number; id: string; label: string;
          product_id: string; sort_order: number; units: number;
        };
        Insert: {
          barcode?: string | null; card_price: number; cash_price: number; id?: string; label: string;
          product_id: string; sort_order?: number; units: number;
        };
        Update: Partial<Database["public"]["Tables"]["pack_sizes"]["Row"]>;
        Relationships: [
          { foreignKeyName: "pack_sizes_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      payments: {
        Row: {
          amount: number; id: string; method: E["payment_method"]; order_id: string; received_at: string;
          received_by: string | null; reference: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & { amount: number; method: E["payment_method"]; order_id: string };
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Relationships: [];
      };
      product_barcodes: {
        Row: { barcode: string; is_case: boolean; product_id: string };
        Insert: { barcode: string; is_case?: boolean; product_id: string };
        Update: { barcode?: string; is_case?: boolean; product_id?: string };
        Relationships: [
          { foreignKeyName: "product_barcodes_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      products: {
        Row: {
          active: boolean; brand: string | null; case_size: number; category: string | null;
          cost_per_case: number | null; created_at: string; id: string; name: string;
          party_case_price: number | null; wholesale_case_price: number | null;
        };
        Insert: {
          active?: boolean; brand?: string | null; case_size?: number; category?: string | null;
          cost_per_case?: number | null; created_at?: string; id?: string; name: string;
          party_case_price?: number | null; wholesale_case_price?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      sale_lines: {
        Row: {
          id: string; line_discount: number; location_id: string | null; pack_size_id: string | null;
          product_id: string; quantity: number; sale_id: string; unit_cost: number | null; unit_price: number;
        };
        Insert: Partial<Database["public"]["Tables"]["sale_lines"]["Row"]> & {
          product_id: string; quantity: number; sale_id: string; unit_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["sale_lines"]["Row"]>;
        Relationships: [];
      };
      sales: {
        Row: {
          client_id: string | null; created_at: string; discount_amount: number;
          discount_kind: E["discount_kind"] | null; discount_value: number | null; id: string;
          price_mode: E["price_mode"]; recorded_offline: boolean; square_checkout_id: string | null;
          staff_id: string | null; subtotal: number; total: number;
        };
        Insert: Partial<Database["public"]["Tables"]["sales"]["Row"]> & { price_mode: E["price_mode"]; subtotal: number; total: number };
        Update: Partial<Database["public"]["Tables"]["sales"]["Row"]>;
        Relationships: [];
      };
      settings: {
        Row: {
          card_markup_percent: number | null; empty_credit_rate: number; id: boolean; same_day_cutoff: string;
          store_address: string | null; store_latitude: number | null; store_longitude: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
        Relationships: [];
      };
      staff: {
        Row: {
          active: boolean; can_edit_prices: boolean; created_at: string; full_name: string; id: string;
          role: E["staff_role"];
        };
        Insert: {
          active?: boolean; can_edit_prices?: boolean; created_at?: string; full_name: string; id: string;
          role?: E["staff_role"];
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Row"]>;
        Relationships: [];
      };
      stock: {
        Row: { location_id: string; product_id: string; quantity: number; updated_at: string };
        Insert: { location_id: string; product_id: string; quantity?: number; updated_at?: string };
        Update: { location_id?: string; product_id?: string; quantity?: number; updated_at?: string };
        Relationships: [
          { foreignKeyName: "stock_location_id_fkey"; columns: ["location_id"]; isOneToOne: false; referencedRelation: "locations"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      stock_movements: {
        Row: {
          created_at: string; from_location: string | null; id: string; kind: E["movement_kind"];
          note: string | null; order_id: string | null; product_id: string; quantity_in: number | null;
          quantity_out: number | null; sale_id: string | null; staff_id: string | null; to_location: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["stock_movements"]["Row"]> & { kind: E["movement_kind"]; product_id: string };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Row"]>;
        Relationships: [
          { foreignKeyName: "stock_movements_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_movements_from_location_fkey"; columns: ["from_location"]; isOneToOne: false; referencedRelation: "locations"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_movements_to_location_fkey"; columns: ["to_location"]; isOneToOne: false; referencedRelation: "locations"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_movements_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] },
        ];
      };
      stock_thresholds: {
        Row: { catalog: E["catalog_kind"]; min_qty: number; product_id: string; target_qty: number };
        Insert: { catalog: E["catalog_kind"]; min_qty: number; product_id: string; target_qty: number };
        Update: { catalog?: E["catalog_kind"]; min_qty?: number; product_id?: string; target_qty?: number };
        Relationships: [
          { foreignKeyName: "stock_thresholds_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      low_stock: {
        Row: {
          case_size: number | null; cases_to_bring_front: number | null; catalog: E["catalog_kind"] | null;
          min_qty: number | null; on_hand: number | null; product_id: string | null; product_name: string | null;
          refill_qty: number | null; target_qty: number | null; warehouse_cases: number | null; where_now: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_first_manager: { Args: { p_full_name: string }; Returns: boolean };
      inv_count: { Args: { p_counted: number; p_location: string; p_note?: string; p_product: string }; Returns: number };
      inv_move: { Args: { p_from: string; p_note?: string; p_product: string; p_qty: number; p_to: string }; Returns: undefined };
      inv_receive: { Args: { p_location: string; p_note?: string; p_product: string; p_qty: number }; Returns: undefined };
      inv_restock: { Args: { p_cases: number; p_from: string; p_note?: string; p_product: string; p_to: string }; Returns: number };
      product_availability: {
        Args: never;
        Returns: { availability: string; catalog: E["catalog_kind"]; product_id: string }[];
      };
    };
    Enums: {
      account_status: "pending" | "approved" | "rejected" | "suspended";
      catalog_kind: "retail" | "warehouse";
      customer_kind: "wholesale" | "retail";
      delivery_status: "not_started" | "prepared" | "en_route" | "heading_to_customer" | "delivered";
      discount_kind: "percent" | "flat";
      line_status: "pending" | "confirmed" | "partial" | "declined";
      location_kind: "commercial_fridge" | "industrial_fridge" | "warehouse_area";
      movement_kind: "receive" | "restock" | "move" | "sale" | "order_pick" | "adjust" | "count";
      order_channel: "online" | "in_store" | "phone";
      order_status: "submitted" | "confirmed" | "partially_confirmed" | "cancelled" | "completed";
      payment_method: "cash" | "check" | "card" | "zelle" | "invoice";
      payment_status: "unpaid" | "partial" | "paid";
      price_mode: "cash" | "card";
      staff_role: "manager" | "staff" | "driver";
      trip_status: "planning" | "departed" | "completed";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never;
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
