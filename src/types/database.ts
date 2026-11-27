/**
 * TickShow database types.
 *
 * Hand-authored to match supabase/migrations/0001-0026. After linking a real
 * Supabase project you can regenerate this file with `npm run db:types:remote`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          phone: string | null;
          status: Database["public"]["Enums"]["account_status"];
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          created_at?: string;
          updated_at?: string;
        }
      >;
      roles: Table<
        {
          id: string;
          name: Database["public"]["Enums"]["app_role"];
          description: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          name: Database["public"]["Enums"]["app_role"];
          description?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          name?: Database["public"]["Enums"]["app_role"];
          description?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      user_roles: Table<
        {
          id: string;
          user_id: string;
          role_id: string;
          assigned_by: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          role_id: string;
          assigned_by?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          role_id?: string;
          assigned_by?: string | null;
          created_at?: string;
        }
      >;
      event_categories: Table<
        {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      events: Table<
        {
          id: string;
          organizer_name: string;
          category_id: string;
          created_by: string | null;
          title: string;
          slug: string;
          description: string | null;
          cover_image_url: string | null;
          gallery_image_urls: string[];
          venue_name: string | null;
          venue_address: string | null;
          venue_city: string | null;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["event_status"];
          approval_status: Database["public"]["Enums"]["approval_status"];
          capacity: number | null;
          published_at: string | null;
          approved_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organizer_name: string;
          category_id: string;
          created_by?: string | null;
          title: string;
          slug: string;
          description?: string | null;
          cover_image_url?: string | null;
          gallery_image_urls?: string[];
          venue_name?: string | null;
          venue_address?: string | null;
          venue_city?: string | null;
          starts_at: string;
          ends_at: string;
          status?: Database["public"]["Enums"]["event_status"];
          approval_status?: Database["public"]["Enums"]["approval_status"];
          capacity?: number | null;
          published_at?: string | null;
          approved_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          organizer_name?: string;
          category_id?: string;
          created_by?: string | null;
          title?: string;
          slug?: string;
          description?: string | null;
          cover_image_url?: string | null;
          gallery_image_urls?: string[];
          venue_name?: string | null;
          venue_address?: string | null;
          venue_city?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: Database["public"]["Enums"]["event_status"];
          approval_status?: Database["public"]["Enums"]["approval_status"];
          capacity?: number | null;
          published_at?: string | null;
          approved_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      event_lineup_items: Table<
        {
          id: string;
          event_id: string;
          name: string;
          role: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          event_id: string;
          name: string;
          role?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          event_id?: string;
          name?: string;
          role?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      event_staff: Table<
        {
          id: string;
          event_id: string;
          user_id: string;
          permission: Database["public"]["Enums"]["event_staff_permission"];
          status: Database["public"]["Enums"]["account_status"];
          assigned_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          event_id: string;
          user_id: string;
          permission?: Database["public"]["Enums"]["event_staff_permission"];
          status?: Database["public"]["Enums"]["account_status"];
          assigned_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          event_id?: string;
          user_id?: string;
          permission?: Database["public"]["Enums"]["event_staff_permission"];
          status?: Database["public"]["Enums"]["account_status"];
          assigned_by?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      ticket_types: Table<
        {
          id: string;
          event_id: string;
          name: string;
          description: string | null;
          price_amount: number;
          currency: string;
          quantity_total: number;
          max_per_order: number;
          sales_start_at: string;
          sales_end_at: string;
          is_active: boolean;
          status: Database["public"]["Enums"]["ticket_type_status"];
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          event_id: string;
          name: string;
          description?: string | null;
          price_amount: number;
          currency?: string;
          quantity_total: number;
          max_per_order?: number;
          sales_start_at: string;
          sales_end_at: string;
          is_active?: boolean;
          status?: Database["public"]["Enums"]["ticket_type_status"];
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          event_id?: string;
          name?: string;
          description?: string | null;
          price_amount?: number;
          currency?: string;
          quantity_total?: number;
          max_per_order?: number;
          sales_start_at?: string;
          sales_end_at?: string;
          is_active?: boolean;
          status?: Database["public"]["Enums"]["ticket_type_status"];
          created_at?: string;
          updated_at?: string;
        }
      >;
      ticket_inventory: Table<
        {
          id: string;
          ticket_type_id: string;
          total_quantity: number;
          reserved_quantity: number;
          sold_quantity: number;
          available_quantity: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          ticket_type_id: string;
          total_quantity: number;
          reserved_quantity?: number;
          sold_quantity?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          ticket_type_id?: string;
          total_quantity?: number;
          reserved_quantity?: number;
          sold_quantity?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      ticket_inventory_reservations: Table<
        {
          id: string;
          ticket_type_id: string;
          order_id: string | null;
          quantity: number;
          status: Database["public"]["Enums"]["inventory_reservation_status"];
          idempotency_key: string | null;
          expires_at: string;
          confirmed_at: string | null;
          released_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          ticket_type_id: string;
          order_id?: string | null;
          quantity: number;
          status?: Database["public"]["Enums"]["inventory_reservation_status"];
          idempotency_key?: string | null;
          expires_at: string;
          confirmed_at?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          ticket_type_id?: string;
          order_id?: string | null;
          quantity?: number;
          status?: Database["public"]["Enums"]["inventory_reservation_status"];
          idempotency_key?: string | null;
          expires_at?: string;
          confirmed_at?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      orders: Table<
        {
          id: string;
          order_number: string;
          customer_id: string | null;
          event_id: string;
          status: Database["public"]["Enums"]["order_status"];
          currency: string;
          subtotal_amount: number;
          discount_amount: number;
          fee_amount: number;
          total_amount: number;
          buyer_name: string;
          buyer_email: string;
          buyer_phone: string | null;
          expires_at: string | null;
          paid_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          order_number?: string;
          customer_id?: string | null;
          event_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          currency?: string;
          subtotal_amount: number;
          discount_amount?: number;
          fee_amount?: number;
          total_amount: number;
          buyer_name: string;
          buyer_email: string;
          buyer_phone?: string | null;
          expires_at?: string | null;
          paid_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          order_number?: string;
          customer_id?: string | null;
          event_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          currency?: string;
          subtotal_amount?: number;
          discount_amount?: number;
          fee_amount?: number;
          total_amount?: number;
          buyer_name?: string;
          buyer_email?: string;
          buyer_phone?: string | null;
          expires_at?: string | null;
          paid_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      order_items: Table<
        {
          id: string;
          order_id: string;
          ticket_type_id: string;
          quantity: number;
          unit_price_amount: number;
          line_total_amount: number;
          currency: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          order_id: string;
          ticket_type_id: string;
          quantity: number;
          unit_price_amount: number;
          line_total_amount: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          order_id?: string;
          ticket_type_id?: string;
          quantity?: number;
          unit_price_amount?: number;
          line_total_amount?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      payments: Table<
        {
          id: string;
          order_id: string;
          payment_intent_id: string | null;
          checkout_session_id: string | null;
          transaction_reference: string | null;
          amount: number;
          refunded_amount: number;
          currency: string;
          status: Database["public"]["Enums"]["payment_status"];
          payment_method: Database["public"]["Enums"]["payment_method"];
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          order_id: string;
          payment_intent_id?: string | null;
          checkout_session_id?: string | null;
          transaction_reference?: string | null;
          amount: number;
          refunded_amount?: number;
          currency?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          payment_method?: Database["public"]["Enums"]["payment_method"];
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          order_id?: string;
          payment_intent_id?: string | null;
          checkout_session_id?: string | null;
          transaction_reference?: string | null;
          amount?: number;
          refunded_amount?: number;
          currency?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          payment_method?: Database["public"]["Enums"]["payment_method"];
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      payment_webhook_events: Table<
        {
          id: string;
          provider: string;
          event_id: string;
          event_type: string;
          payload: Json;
          signature_verified: boolean;
          processed_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          provider?: string;
          event_id: string;
          event_type: string;
          payload?: Json;
          signature_verified?: boolean;
          processed_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          provider?: string;
          event_id?: string;
          event_type?: string;
          payload?: Json;
          signature_verified?: boolean;
          processed_at?: string | null;
          created_at?: string;
        }
      >;
      tickets: Table<
        {
          id: string;
          ticket_number: string;
          order_id: string;
          order_item_id: string;
          customer_id: string | null;
          event_id: string;
          ticket_type_id: string;
          qr_token_hash: string;
          status: Database["public"]["Enums"]["ticket_status"];
          checkin_status: Database["public"]["Enums"]["checkin_status"];
          issued_at: string;
          checked_in_at: string | null;
          token_issued_at: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          ticket_number?: string;
          order_id: string;
          order_item_id: string;
          customer_id?: string | null;
          event_id: string;
          ticket_type_id: string;
          qr_token_hash: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          checkin_status?: Database["public"]["Enums"]["checkin_status"];
          issued_at?: string;
          checked_in_at?: string | null;
          token_issued_at?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          ticket_number?: string;
          order_id?: string;
          order_item_id?: string;
          customer_id?: string | null;
          event_id?: string;
          ticket_type_id?: string;
          qr_token_hash?: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          checkin_status?: Database["public"]["Enums"]["checkin_status"];
          issued_at?: string;
          checked_in_at?: string | null;
          token_issued_at?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      ticket_checkins: Table<
        {
          id: string;
          ticket_id: string;
          event_id: string;
          scanned_by: string | null;
          result: Database["public"]["Enums"]["checkin_result"];
          denied_reason: string | null;
          device_info: string | null;
          created_at: string;
        },
        {
          id?: string;
          ticket_id: string;
          event_id: string;
          scanned_by?: string | null;
          result: Database["public"]["Enums"]["checkin_result"];
          denied_reason?: string | null;
          device_info?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          ticket_id?: string;
          event_id?: string;
          scanned_by?: string | null;
          result?: Database["public"]["Enums"]["checkin_result"];
          denied_reason?: string | null;
          device_info?: string | null;
          created_at?: string;
        }
      >;
      refunds: Table<
        {
          id: string;
          payment_id: string;
          order_id: string;
          stripe_refund_id: string | null;
          amount: number;
          currency: string;
          status: Database["public"]["Enums"]["refund_status"];
          reason: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          payment_id: string;
          order_id: string;
          stripe_refund_id?: string | null;
          amount: number;
          currency?: string;
          status?: Database["public"]["Enums"]["refund_status"];
          reason?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          payment_id?: string;
          order_id?: string;
          stripe_refund_id?: string | null;
          amount?: number;
          currency?: string;
          status?: Database["public"]["Enums"]["refund_status"];
          reason?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body: string | null;
          data: Json;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body?: string | null;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          title?: string;
          body?: string | null;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      reviews: Table<
        {
          id: string;
          event_id: string;
          customer_id: string;
          rating: number;
          title: string | null;
          comment: string | null;
          status: Database["public"]["Enums"]["review_status"];
          moderated_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          event_id: string;
          customer_id: string;
          rating: number;
          title?: string | null;
          comment?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          moderated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          event_id?: string;
          customer_id?: string;
          rating?: number;
          title?: string | null;
          comment?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          moderated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      platform_settings: Table<
        {
          id: string;
          key: string;
          value: Json;
          description: string | null;
          is_public: boolean;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          key: string;
          value: Json;
          description?: string | null;
          is_public?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          key?: string;
          value?: Json;
          description?: string | null;
          is_public?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      audit_logs: Table<
        {
          id: string;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          changes: Json;
          ip_address: string | null;
          created_at: string;
        },
        {
          id?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          changes?: Json;
          ip_address?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          changes?: Json;
          ip_address?: string | null;
          created_at?: string;
        }
      >;
      storefront_events: Table<
        {
          id: string;
          normalized_event_id: string | null;
          organizer_name: string | null;
          starts_at: string | null;
          ends_at: string | null;
          capacity: number | null;
          ticket_design_style: string;
          ticket_design_image_path: string | null;
          slug: string;
          title: string;
          category: string;
          event_group: Database["public"]["Enums"]["storefront_event_group"];
          display_order: number;
          is_visible: boolean;
          status_label: string;
          date_label: string;
          date_value: string;
          time_label: string | null;
          venue: string | null;
          location: string | null;
          city: string | null;
          price_amount: number;
          currency: string;
          image_url: string | null;
          image_alt: string | null;
          about: string | null;
          lineup: Json;
          is_carousel: boolean;
          carousel_order: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          normalized_event_id?: string | null;
          organizer_name?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          capacity?: number | null;
          ticket_design_style?: string;
          ticket_design_image_path?: string | null;
          slug: string;
          title: string;
          category: string;
          event_group?: Database["public"]["Enums"]["storefront_event_group"];
          display_order?: number;
          is_visible?: boolean;
          status_label?: string;
          date_label: string;
          date_value: string;
          time_label?: string | null;
          venue?: string | null;
          location?: string | null;
          city?: string | null;
          price_amount?: number;
          currency?: string;
          image_url?: string | null;
          image_alt?: string | null;
          about?: string | null;
          lineup?: Json;
          is_carousel?: boolean;
          carousel_order?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          normalized_event_id?: string | null;
          organizer_name?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          capacity?: number | null;
          ticket_design_style?: string;
          ticket_design_image_path?: string | null;
          slug?: string;
          title?: string;
          category?: string;
          event_group?: Database["public"]["Enums"]["storefront_event_group"];
          display_order?: number;
          is_visible?: boolean;
          status_label?: string;
          date_label?: string;
          date_value?: string;
          time_label?: string | null;
          venue?: string | null;
          location?: string | null;
          city?: string | null;
          price_amount?: number;
          currency?: string;
          image_url?: string | null;
          image_alt?: string | null;
          about?: string | null;
          lineup?: Json;
          is_carousel?: boolean;
          carousel_order?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      storefront_bookings: Table<
        {
          id: string;
          booking_reference: string;
          storefront_event_id: string | null;
          customer_id: string | null;
          event_slug: string;
          event_title: string;
          event_date_label: string | null;
          event_time_label: string | null;
          event_venue: string | null;
          event_location: string | null;
          ticket_design_style: string;
          ticket_design_image_path: string | null;
          quantity: number;
          unit_price_amount: number;
          total_amount: number;
          currency: string;
          buyer_name: string;
          buyer_email: string;
          buyer_phone: string;
          created_at: string;
          is_demo: boolean;
          ticket_emailed_at: string | null;
          ticket_downloaded_at: string | null;
          ticket_email_status: "pending" | "sending" | "sent" | "failed";
          ticket_assets_status: "pending" | "generating" | "ready";
          ticket_assets_started_at: string | null;
        },
        {
          id?: string;
          booking_reference: string;
          storefront_event_id?: string | null;
          customer_id?: string | null;
          event_slug: string;
          event_title: string;
          event_date_label?: string | null;
          event_time_label?: string | null;
          event_venue?: string | null;
          event_location?: string | null;
          ticket_design_style?: string;
          ticket_design_image_path?: string | null;
          quantity: number;
          unit_price_amount: number;
          total_amount: number;
          currency?: string;
          buyer_name: string;
          buyer_email: string;
          buyer_phone: string;
          created_at?: string;
          is_demo?: boolean;
          ticket_emailed_at?: string | null;
          ticket_downloaded_at?: string | null;
          ticket_email_status?: "pending" | "sending" | "sent" | "failed";
          ticket_assets_status?: "pending" | "generating" | "ready";
          ticket_assets_started_at?: string | null;
        },
        {
          id?: string;
          booking_reference?: string;
          storefront_event_id?: string | null;
          customer_id?: string | null;
          event_slug?: string;
          event_title?: string;
          event_date_label?: string | null;
          event_time_label?: string | null;
          event_venue?: string | null;
          event_location?: string | null;
          ticket_design_style?: string;
          ticket_design_image_path?: string | null;
          quantity?: number;
          unit_price_amount?: number;
          total_amount?: number;
          currency?: string;
          buyer_name?: string;
          buyer_email?: string;
          buyer_phone?: string;
          created_at?: string;
          is_demo?: boolean;
          ticket_emailed_at?: string | null;
          ticket_downloaded_at?: string | null;
          ticket_email_status?: "pending" | "sending" | "sent" | "failed";
          ticket_assets_status?: "pending" | "generating" | "ready";
          ticket_assets_started_at?: string | null;
        }
      >;
      storefront_tickets: Table<
        {
          id: string;
          booking_id: string;
          ticket_number: number;
          token_hash: string;
          revoked_at: string | null;
          checked_in_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          booking_id: string;
          ticket_number: number;
          token_hash: string;
          revoked_at?: string | null;
          checked_in_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          booking_id?: string;
          ticket_number?: number;
          token_hash?: string;
          revoked_at?: string | null;
          checked_in_at?: string | null;
          created_at?: string;
        }
      >;
      admin_invitations: Table<
        {
          id: string;
          email: string;
          token_hash: string;
          invited_by: string | null;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          email: string;
          token_hash: string;
          invited_by?: string | null;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          email?: string;
          token_hash?: string;
          invited_by?: string | null;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      assign_user_role: {
        Args: { p_user_id: string; p_role: Database["public"]["Enums"]["app_role"] };
        Returns: Database["public"]["Tables"]["user_roles"]["Row"] | null;
      };
      remove_user_role: {
        Args: { p_user_id: string; p_role: Database["public"]["Enums"]["app_role"] };
        Returns: boolean;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_service_role: { Args: Record<string, never>; Returns: boolean };
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] };
        Returns: boolean;
      };
      can_access_event: { Args: { p_event_id: string }; Returns: boolean };
      can_manage_event: { Args: { p_event_id: string }; Returns: boolean };
      can_checkin_event: { Args: { p_event_id: string }; Returns: boolean };
      is_event_public: { Args: { p_event_id: string }; Returns: boolean };
      owns_order: { Args: { p_order_id: string }; Returns: boolean };
      can_access_order: { Args: { p_order_id: string }; Returns: boolean };
      can_view_ticket: { Args: { p_ticket_id: string }; Returns: boolean };
      can_access_reservation: { Args: { p_reservation_id: string }; Returns: boolean };
      create_admin_invitation: {
        Args: { p_email: string; p_token_hash: string; p_expires_in?: string };
        Returns: Database["public"]["Tables"]["admin_invitations"]["Row"] | null;
      };
      accept_admin_invitation: {
        Args: { p_user_id: string; p_token_hash: string };
        Returns: boolean;
      };
      storage_path_uuid: { Args: { p_name: string }; Returns: string | null };
      storage_path_owned_by_user: { Args: { p_name: string }; Returns: boolean };
      create_storefront_booking: {
        Args: {
          p_event_slug: string;
          p_quantity: number;
          p_buyer_name: string;
          p_buyer_email: string;
          p_buyer_phone: string;
        };
        Returns: { booking_reference: string; total_amount: number }[];
      };
      claim_storefront_ticket_email: {
        Args: { p_booking_reference: string; p_resend?: boolean };
        Returns: boolean;
      };
      finish_storefront_ticket_email: {
        Args: { p_booking_reference: string; p_sent: boolean };
        Returns: undefined;
      };
      claim_storefront_ticket_assets: {
        Args: { p_booking_reference: string; p_force?: boolean };
        Returns: boolean;
      };
      finish_storefront_ticket_assets: {
        Args: { p_booking_reference: string; p_ready: boolean };
        Returns: undefined;
      };
      claim_storefront_ticket_download: {
        Args: { p_booking_reference: string };
        Returns: { claimed: boolean; already_downloaded_at: string | null }[];
      };
      verify_storefront_ticket_by_id: {
        Args: { p_ticket_id: string; p_ticket_token: string };
        Returns: {
          valid: boolean;
          event_title: string | null;
          event_date: string | null;
          event_time: string | null;
          event_venue: string | null;
          event_location: string | null;
          booking_reference: string | null;
          ticket_number: number | null;
          already_checked_in: boolean;
        }[];
      };
      verify_storefront_ticket: {
        Args: { p_booking_reference: string; p_ticket_token: string };
        Returns: {
          valid: boolean;
          event_title: string | null;
          event_date: string | null;
          event_venue: string | null;
          event_location: string | null;
          quantity: number | null;
        }[];
      };
      delete_own_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      app_role: "admin" | "staff" | "customer";
      account_status: "active" | "suspended";
      approval_status: "pending" | "approved" | "rejected";
      event_status: "draft" | "pending" | "published" | "rejected" | "cancelled" | "completed";
      ticket_type_status: "draft" | "active" | "paused" | "archived";
      inventory_reservation_status: "pending" | "confirmed" | "released" | "expired" | "cancelled";
      order_status: "pending" | "paid" | "failed" | "cancelled" | "refunded" | "expired";
      payment_status: "pending" | "processing" | "succeeded" | "failed" | "cancelled" | "refunded" | "partially_refunded";
      payment_method: "card" | "bkash" | "nagad" | "bank_transfer" | "other";
      refund_status: "pending" | "processing" | "succeeded" | "failed";
      ticket_status: "valid" | "used" | "cancelled" | "refunded" | "expired";
      checkin_status: "not_checked_in" | "checked_in" | "void";
      checkin_result: "success" | "denied" | "reversed";
      event_staff_permission: "view" | "checkin" | "manage_orders";
      review_status: "pending" | "approved" | "rejected";
      notification_type: "order_created" | "payment_succeeded" | "payment_failed" | "ticket_issued" | "event_published" | "event_cancelled" | "refund_issued" | "system";
      storefront_event_group: "past" | "upcoming" | "ongoing";
    };
    CompositeTypes: Record<string, never>;
  };
};
