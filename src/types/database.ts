export type Role = "super_admin" | "user"
export type ModuleAccessLevel = "admin" | "member"
export type Module = "regulatory" | "recruitment" | "crm"
export type AssignmentType = "primary" | "temporary"
export type ConsultationStatus = "draft" | "in_progress" | "under_review" | "completed" | "archived"
export type RegulatoryFramework = "aicis" | "reach" | "tsca"
export type RegulatoryStatus = "listed" | "not_listed" | "exempt" | "restricted" | "pending" | "unknown"
export type AliasType = "trade_name" | "synonym" | "iupac" | "cas_rn"
export type AliasSource = "pubchem" | "echa" | "manual"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: Role
          full_name: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          role?: Role
          full_name?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          role?: Role
          full_name?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          name: string
          abn: string | null
          country: string | null
          industry: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          abn?: string | null
          country?: string | null
          industry?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          abn?: string | null
          country?: string | null
          industry?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      allowed_email_domains: {
        Row: {
          id: string
          domain: string
          added_by: string | null
          added_at: string
        }
        Insert: {
          id?: string
          domain: string
          added_by?: string | null
        }
        Update: {
          domain?: string
        }
        Relationships: []
      }
      user_module_access: {
        Row: {
          id: string
          user_id: string
          module: Module
          access_level: ModuleAccessLevel
          granted_at: string
          granted_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          module: Module
          access_level: ModuleAccessLevel
          granted_by?: string | null
        }
        Update: {
          access_level?: ModuleAccessLevel
        }
        Relationships: [
          {
            foreignKeyName: "user_module_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_module_admin: {
        Args: { mod: string }
        Returns: boolean
      }
      has_module_access: {
        Args: { mod: string }
        Returns: boolean
      }
      has_company_access: {
        Args: { cid: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  regulatory: {
    Tables: {
      consultant_company_assignments: {
        Row: {
          id: string
          consultant_id: string
          company_id: string
          assignment_type: AssignmentType
          start_date: string
          end_date: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          consultant_id: string
          company_id: string
          assignment_type: AssignmentType
          start_date?: string
          end_date?: string | null
          notes?: string | null
        }
        Update: {
          assignment_type?: AssignmentType
          end_date?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_company_assignments_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_company_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      consultations: {
        Row: {
          id: string
          company_id: string
          title: string
          description: string | null
          status: ConsultationStatus
          frameworks: RegulatoryFramework[]
          reference_number: string | null
          due_date: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          title: string
          description?: string | null
          status?: ConsultationStatus
          frameworks: RegulatoryFramework[]
          reference_number?: string | null
          due_date?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          status?: ConsultationStatus
          frameworks?: RegulatoryFramework[]
          reference_number?: string | null
          due_date?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      chemicals: {
        Row: {
          id: string
          cas_number: string | null
          iupac_name: string | null
          common_name: string
          molecular_formula: string | null
          molecular_weight: number | null
          inchi_key: string | null
          pubchem_cid: number | null
          needs_review: boolean
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cas_number?: string | null
          iupac_name?: string | null
          common_name: string
          molecular_formula?: string | null
          molecular_weight?: number | null
          inchi_key?: string | null
          pubchem_cid?: number | null
          needs_review?: boolean
          resolved_at?: string | null
        }
        Update: {
          cas_number?: string | null
          iupac_name?: string | null
          common_name?: string
          molecular_formula?: string | null
          molecular_weight?: number | null
          inchi_key?: string | null
          pubchem_cid?: number | null
          needs_review?: boolean
          resolved_at?: string | null
        }
        Relationships: []
      }
      chemical_aliases: {
        Row: {
          id: string
          chemical_id: string
          alias: string
          alias_type: AliasType | null
          source: AliasSource | null
        }
        Insert: {
          id?: string
          chemical_id: string
          alias: string
          alias_type?: AliasType | null
          source?: AliasSource | null
        }
        Update: {
          alias?: string
          alias_type?: AliasType | null
          source?: AliasSource | null
        }
        Relationships: [
          {
            foreignKeyName: "chemical_aliases_chemical_id_fkey"
            columns: ["chemical_id"]
            isOneToOne: false
            referencedRelation: "chemicals"
            referencedColumns: ["id"]
          }
        ]
      }
      consultation_chemicals: {
        Row: {
          id: string
          consultation_id: string
          chemical_id: string
          role: string | null
          quantity: number | null
          unit: string | null
          notes: string | null
          added_at: string
        }
        Insert: {
          id?: string
          consultation_id: string
          chemical_id: string
          role?: string | null
          quantity?: number | null
          unit?: string | null
          notes?: string | null
        }
        Update: {
          role?: string | null
          quantity?: number | null
          unit?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_chemicals_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_chemicals_chemical_id_fkey"
            columns: ["chemical_id"]
            isOneToOne: false
            referencedRelation: "chemicals"
            referencedColumns: ["id"]
          }
        ]
      }
      regulatory_listings: {
        Row: {
          id: string
          chemical_id: string
          framework: RegulatoryFramework
          status: RegulatoryStatus
          list_name: string | null
          list_url: string | null
          effective_date: string | null
          notes: string | null
          last_checked: string
          source: string | null
        }
        Insert: {
          id?: string
          chemical_id: string
          framework: RegulatoryFramework
          status?: RegulatoryStatus
          list_name?: string | null
          list_url?: string | null
          effective_date?: string | null
          notes?: string | null
          last_checked?: string
          source?: string | null
        }
        Update: {
          status?: RegulatoryStatus
          list_name?: string | null
          list_url?: string | null
          effective_date?: string | null
          notes?: string | null
          last_checked?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_listings_chemical_id_fkey"
            columns: ["chemical_id"]
            isOneToOne: false
            referencedRelation: "chemicals"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
