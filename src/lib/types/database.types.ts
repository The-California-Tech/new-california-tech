export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      image_metadata: {
        Row: {
          bucket_id: string;
          created_at: string;
          height: number;
          id: number;
          object_path: string;
          storage_object_id: string | null;
          updated_at: string;
          width: number;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          height: number;
          id?: never;
          object_path: string;
          storage_object_id?: string | null;
          updated_at?: string;
          width: number;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          height?: number;
          id?: never;
          object_path?: string;
          storage_object_id?: string | null;
          updated_at?: string;
          width?: number;
        };
        Relationships: [];
      };
      pages: {
        Row: {
          authors: Json | null;
          content: string | null;
          cover: string | null;
          datasource_alias: string;
          datasource_id: string;
          last_synced_at: string | null;
          meta: Json | null;
          page_id: string;
          publish_at: string | null;
          search_fts: unknown;
          slug: string | null;
          summary: string | null;
          tags: Json | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          authors?: Json | null;
          content?: string | null;
          cover?: string | null;
          datasource_alias: string;
          datasource_id: string;
          last_synced_at?: string | null;
          meta?: Json | null;
          page_id: string;
          publish_at?: string | null;
          search_fts?: unknown;
          slug?: string | null;
          summary?: string | null;
          tags?: Json | null;
          title: string;
          updated_at: string;
        };
        Update: {
          authors?: Json | null;
          content?: string | null;
          cover?: string | null;
          datasource_alias?: string;
          datasource_id?: string;
          last_synced_at?: string | null;
          meta?: Json | null;
          page_id?: string;
          publish_at?: string | null;
          search_fts?: unknown;
          slug?: string | null;
          summary?: string | null;
          tags?: Json | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      list_author_posts: {
        Args: {
          p_datasource_alias: string;
          p_limit?: number;
          p_names: string[];
          p_offset?: number;
        };
        Returns: {
          authors: Json;
          content_preview: string;
          cover: string;
          cover_height: number;
          cover_width: number;
          datasource_alias: string;
          datasource_id: string;
          meta: Json;
          page_id: string;
          publish_at: string;
          slug: string;
          summary: string;
          tags: Json;
          title: string;
          total_posts: number;
          updated_at: string;
        }[];
      };
      list_authors: {
        Args: { p_datasource_alias: string };
        Returns: {
          article_count: number;
          latest_publish_at: string;
          name: string;
        }[];
      };
      list_categories: {
        Args: { p_datasource_alias: string };
        Returns: {
          article_count: number;
          latest_publish_at: string;
          name: string;
        }[];
      };
      list_category_posts: {
        Args: {
          p_datasource_alias: string;
          p_limit?: number;
          p_offset?: number;
          p_tags: string[];
        };
        Returns: {
          authors: Json;
          content_preview: string;
          cover: string;
          cover_height: number;
          cover_width: number;
          datasource_alias: string;
          datasource_id: string;
          meta: Json;
          page_id: string;
          publish_at: string;
          slug: string;
          summary: string;
          tags: Json;
          title: string;
          total_posts: number;
          updated_at: string;
        }[];
      };
      list_homepage_posts: {
        Args: {
          p_before_date?: string;
          p_issue_offset?: number;
          p_query?: string;
          p_tag?: string;
          p_target_count?: number;
        };
        Returns: {
          authors: Json;
          content_preview: string;
          cover: string;
          cover_height: number;
          cover_width: number;
          datasource_alias: string;
          datasource_id: string;
          issue_date: string;
          issue_rank: number;
          last_synced_at: string;
          meta: Json;
          page_id: string;
          publish_at: string;
          slug: string;
          summary: string;
          tags: Json;
          title: string;
          total_issues: number;
          total_posts: number;
          updated_at: string;
        }[];
      };
      list_storage_objects_recursive: {
        Args: {
          p_after_name?: string;
          p_bucket_id: string;
          p_limit?: number;
          p_prefix?: string;
        };
        Returns: {
          bucket_id: string;
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          owner: string;
          updated_at: string;
        }[];
      };
      list_unique_tags: {
        Args: { p_datasource_alias: string };
        Returns: {
          tag: string;
        }[];
      };
      nearest_issue_date: { Args: { p_target: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
