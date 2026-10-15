// Database types for the ContractIQ schema (database.sql).
// Format matches `supabase gen types typescript`; regenerate with `npm run db:types`
// after schema changes and keep this file in sync.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          plan: string;
          trial_ends_at: string;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          plan?: string;
          trial_ends_at?: string;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          plan?: string;
          trial_ends_at?: string;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_size_bytes: number;
          contract_type: Database['public']['Enums']['contract_type'];
          status: Database['public']['Enums']['contract_status'];
          contract_text: string | null;
          page_count: number | null;
          word_count: number | null;
          token_count: number | null;
          file_path: string | null;
          error_code: string | null;
          error_message: string | null;
          prompt_version: string | null;
          processing_started_at: string | null;
          processing_completed_at: string | null;
          processing_ms: number | null;
          last_accessed_at: string;
          pdf_deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_size_bytes: number;
          contract_type: Database['public']['Enums']['contract_type'];
          status?: Database['public']['Enums']['contract_status'];
          contract_text?: string | null;
          page_count?: number | null;
          word_count?: number | null;
          token_count?: number | null;
          file_path?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          prompt_version?: string | null;
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          processing_ms?: number | null;
          last_accessed_at?: string;
          pdf_deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          file_size_bytes?: number;
          contract_type?: Database['public']['Enums']['contract_type'];
          status?: Database['public']['Enums']['contract_status'];
          contract_text?: string | null;
          page_count?: number | null;
          word_count?: number | null;
          token_count?: number | null;
          file_path?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          prompt_version?: string | null;
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          processing_ms?: number | null;
          last_accessed_at?: string;
          pdf_deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      custom_key_terms: {
        Row: {
          id: string;
          contract_id: string;
          user_id: string;
          term_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          user_id: string;
          term_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          contract_id?: string;
          user_id?: string;
          term_name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'custom_key_terms_contract_id_fkey';
            columns: ['contract_id'];
            isOneToOne: false;
            referencedRelation: 'contracts';
            referencedColumns: ['id'];
          },
        ];
      };
      key_terms: {
        Row: {
          id: string;
          contract_id: string;
          user_id: string;
          term_name: string;
          term_key: string;
          value: string | null;
          original_value: string | null;
          page_number: number | null;
          confidence_score: number;
          source_sentence: string | null;
          is_custom: boolean;
          is_edited: boolean;
          edited_at: string | null;
          display_order: number;
          validation_flags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          user_id: string;
          term_name: string;
          term_key: string;
          value?: string | null;
          original_value?: string | null;
          page_number?: number | null;
          confidence_score: number;
          source_sentence?: string | null;
          is_custom?: boolean;
          is_edited?: boolean;
          edited_at?: string | null;
          display_order: number;
          validation_flags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contract_id?: string;
          user_id?: string;
          term_name?: string;
          term_key?: string;
          value?: string | null;
          original_value?: string | null;
          page_number?: number | null;
          confidence_score?: number;
          source_sentence?: string | null;
          is_custom?: boolean;
          is_edited?: boolean;
          edited_at?: string | null;
          display_order?: number;
          validation_flags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'key_terms_contract_id_fkey';
            columns: ['contract_id'];
            isOneToOne: false;
            referencedRelation: 'contracts';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_sessions: {
        Row: {
          id: string;
          contract_id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contract_id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_sessions_contract_id_fkey';
            columns: ['contract_id'];
            isOneToOne: true;
            referencedRelation: 'contracts';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          role: Database['public']['Enums']['chat_role'];
          content: string;
          cited_pages: number[];
          missing_citation: boolean;
          query_type: string | null;
          is_partial: boolean;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          role: Database['public']['Enums']['chat_role'];
          content: string;
          cited_pages?: number[];
          missing_citation?: boolean;
          query_type?: string | null;
          is_partial?: boolean;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          role?: Database['public']['Enums']['chat_role'];
          content?: string;
          cited_pages?: number[];
          missing_citation?: boolean;
          query_type?: string | null;
          is_partial?: boolean;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'chat_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      user_feedback: {
        Row: {
          id: string;
          contract_id: string;
          user_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          user_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contract_id?: string;
          user_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_feedback_contract_id_fkey';
            columns: ['contract_id'];
            isOneToOne: false;
            referencedRelation: 'contracts';
            referencedColumns: ['id'];
          },
        ];
      };
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          contract_id: string | null;
          event_type: Database['public']['Enums']['usage_event_type'];
          model: string;
          prompt_version: string | null;
          prompt_tokens: number;
          completion_tokens: number;
          cost_usd: number;
          latency_ms: number | null;
          success: boolean;
          error_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          contract_id?: string | null;
          event_type: Database['public']['Enums']['usage_event_type'];
          model: string;
          prompt_version?: string | null;
          prompt_tokens?: number;
          completion_tokens?: number;
          cost_usd?: number;
          latency_ms?: number | null;
          success: boolean;
          error_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          contract_id?: string | null;
          event_type?: Database['public']['Enums']['usage_event_type'];
          model?: string;
          prompt_version?: string | null;
          prompt_tokens?: number;
          completion_tokens?: number;
          cost_usd?: number;
          latency_ms?: number | null;
          success?: boolean;
          error_code?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rate_limit_events: {
        Row: { id: string; user_id: string | null; subject: string; action: string; created_at: string };
        Insert: { id?: string; user_id?: string | null; subject: string; action: string; created_at?: string };
        Update: { id?: string; user_id?: string | null; subject?: string; action?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: {
      term_corrections: {
        Row: {
          id: string | null;
          user_id: string | null;
          contract_id: string | null;
          contract_type: Database['public']['Enums']['contract_type'] | null;
          term_key: string | null;
          original_value: string | null;
          corrected_value: string | null;
          confidence_score: number | null;
          edited_at: string | null;
        };
        Relationships: [];
      };
      contract_list_items: {
        Row: {
          id: string | null;
          user_id: string | null;
          file_name: string | null;
          contract_type: Database['public']['Enums']['contract_type'] | null;
          status: Database['public']['Enums']['contract_status'] | null;
          page_count: number | null;
          processing_started_at: string | null;
          processing_completed_at: string | null;
          created_at: string | null;
          low_confidence_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      replace_key_terms: {
        Args: { p_contract_id: string; p_user_id: string; p_terms: Json };
        Returns: number;
      };
      rate_limit_hit: {
        Args: { p_subject: string; p_user_id: string; p_action: string; p_limit: number; p_window_seconds: number };
        Returns: number;
      };
    };
    Enums: {
      contract_type: 'NDA' | 'MSA';
      contract_status: 'uploading' | 'ready' | 'processing' | 'completed' | 'error';
      chat_role: 'user' | 'assistant';
      usage_event_type: 'extraction' | 'chat';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
