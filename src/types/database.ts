export type Role = "super_admin" | "user"
export type UserType = "internal" | "contractor" | "supervisor"
export type ModuleAccessLevel = "admin" | "member"
export type Module = "regulatory" | "recruitment" | "timesheets"
export type AssignmentType = "primary" | "temporary"
export type ConsultationStatus = "draft" | "in_progress" | "under_review" | "completed" | "archived"
export type RegulatoryFramework = "aicis" | "reach" | "tsca"
export type RegulatoryStatus = "listed" | "not_listed" | "exempt" | "restricted" | "pending" | "unknown"
export type AliasType = "trade_name" | "synonym" | "iupac" | "cas_rn" | "ec_number"
export type AliasSource = "pubchem" | "echa" | "manual"

export interface ModuleConfig {
  module: Module
  is_enabled: boolean
  updated_at: string | null
}

// Lookup values
export type LookupScope = "global" | "regulatory" | "recruitment" | "timesheets"

// CRM
export type ContactActivity = "call" | "email" | "meeting" | "note"
export type OpportunityStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
export type CrmStatus = "lead" | "prospect" | "client" | "inactive"
export type OpportunityModule = "regulatory" | "recruitment" | "both"

// Recruitment
export type JobStatus = "opened" | "posted" | "active" | "paused" | "filled" | "closed"
export type JobEventType = "opened" | "posted" | "active" | "paused" | "filled" | "closed" | "note"
export type ApplicationStage = "applied" | "screening" | "shortlisted" | "interview_1" | "interview_2" | "reference_check" | "offer" | "placed" | "withdrawn" | "rejected"
export type ApplicationSource = "seek_inbound" | "company_website" | "database_internal" | "seek_talent" | "linkedin"
export type EmploymentType = "permanent" | "contract" | "casual" | "full_time" | "part_time"
export type PlacementType = "permanent" | "contract"
export type PlacementStatus = "confirmed" | "started" | "completed" | "cancelled"
export type TaskType = "finance_invoice" | "finance_contract" | "security_clearance" | "general"
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled"
export type ScheduledEmailStatus = "pending" | "sent" | "cancelled" | "failed"
export type CvParseStatus = "unparsed" | "pending" | "parsed" | "failed"
export type CvParsedBy = "gemini" | "claude" | "azure" | "daxtra" | "manual"

// Timesheets
export type ContractStatus = "active" | "expired" | "terminated"
export type ContractEventType = "created" | "extended" | "terminated" | "supervisor_changed"
export type TimesheetStatus = "draft" | "submitted" | "approved" | "declined"
export type TimesheetEventType = "submitted" | "approved" | "declined" | "amended" | "resubmitted"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: Role
          user_type: UserType
          full_name: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          role?: Role
          user_type?: UserType
          full_name?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          role?: Role
          user_type?: UserType
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
          account_owner_id: string | null
          crm_status: CrmStatus
          last_activity_at: string | null
          address_line1: string | null
          address_line2: string | null
          suburb: string | null
          state: string | null
          postcode: string | null
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
          account_owner_id?: string | null
          crm_status?: CrmStatus
          address_line1?: string | null
          address_line2?: string | null
          suburb?: string | null
          state?: string | null
          postcode?: string | null
        }
        Update: {
          name?: string
          abn?: string | null
          country?: string | null
          industry?: string | null
          notes?: string | null
          is_active?: boolean
          account_owner_id?: string | null
          crm_status?: CrmStatus
          last_activity_at?: string | null
          address_line1?: string | null
          address_line2?: string | null
          suburb?: string | null
          state?: string | null
          postcode?: string | null
        }
        Relationships: []
      }
      company_branches: {
        Row: {
          id: string
          company_id: string
          name: string
          address_line1: string | null
          address_line2: string | null
          suburb: string | null
          state: string | null
          postcode: string | null
          country: string | null
          is_head_office: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          address_line1?: string | null
          address_line2?: string | null
          suburb?: string | null
          state?: string | null
          postcode?: string | null
          country?: string | null
          is_head_office?: boolean
          is_active?: boolean
        }
        Update: {
          name?: string
          address_line1?: string | null
          address_line2?: string | null
          suburb?: string | null
          state?: string | null
          postcode?: string | null
          country?: string | null
          is_head_office?: boolean
          is_active?: boolean
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          company_id: string
          branch_id: string | null
          first_name: string
          last_name: string
          title: string | null
          department: string | null
          email: string | null
          phone: string | null
          is_primary: boolean
          notes: string | null
          added_by: string | null
          is_active: boolean
          is_crm_contact: boolean
          is_regulatory_contact: boolean
          is_recruitment_contact: boolean
          is_timesheets_supervisor: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          branch_id?: string | null
          first_name: string
          last_name: string
          title?: string | null
          department?: string | null
          email?: string | null
          phone?: string | null
          is_primary?: boolean
          notes?: string | null
          added_by?: string | null
          is_active?: boolean
          is_crm_contact?: boolean
          is_regulatory_contact?: boolean
          is_recruitment_contact?: boolean
          is_timesheets_supervisor?: boolean
        }
        Update: {
          branch_id?: string | null
          first_name?: string
          last_name?: string
          title?: string | null
          department?: string | null
          email?: string | null
          phone?: string | null
          is_primary?: boolean
          notes?: string | null
          is_active?: boolean
          is_crm_contact?: boolean
          is_regulatory_contact?: boolean
          is_recruitment_contact?: boolean
          is_timesheets_supervisor?: boolean
        }
        Relationships: []
      }
      company_activities: {
        Row: {
          id: string
          company_id: string
          contact_id: string | null
          activity_type: ContactActivity
          subject: string
          body: string | null
          occurred_at: string
          performed_by: string
          linked_module: Module | null
          linked_record_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          contact_id?: string | null
          activity_type: ContactActivity
          subject: string
          body?: string | null
          occurred_at?: string
          performed_by: string
          linked_module?: Module | null
          linked_record_id?: string | null
        }
        Update: Record<string, never>
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
      lookup_values: {
        Row: {
          id: string
          scope: LookupScope
          category: string
          value: string
          label: string
          sort_order: number
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scope: LookupScope
          category: string
          value: string
          label: string
          sort_order?: number
          is_active?: boolean
          created_by?: string | null
        }
        Update: {
          label?: string
          sort_order?: number
          is_active?: boolean
        }
        Relationships: []
      }
      module_config: {
        Row: {
          module:     Module
          is_enabled: boolean
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          module:      Module
          is_enabled?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          is_enabled?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: boolean
          emails_paused: boolean
          emails_paused_by: string | null
          emails_paused_at: string | null
          ai_paused: boolean
          ai_paused_by: string | null
          ai_paused_at: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          emails_paused?: boolean
          emails_paused_by?: string | null
          emails_paused_at?: string | null
          ai_paused?: boolean
          ai_paused_by?: string | null
          ai_paused_at?: string | null
        }
        Update: {
          emails_paused?: boolean
          emails_paused_by?: string | null
          emails_paused_at?: string | null
          ai_paused?: boolean
          ai_paused_by?: string | null
          ai_paused_at?: string | null
        }
        Relationships: []
      }
      user_groups: {
        Row: {
          id: string
          name: string
          description: string | null
          is_locked: boolean
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_locked?: boolean
          created_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
        }
        Relationships: []
      }
      user_group_permissions: {
        Row: {
          id: string
          group_id: string
          permission_key: string
        }
        Insert: {
          id?: string
          group_id: string
          permission_key: string
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: "user_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          }
        ]
      }
      user_group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          granted_at: string
          granted_by: string | null
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          granted_by?: string | null
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: "user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_user_id_fkey"
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
      can_manage_lookup: {
        Args: { p_scope: string }
        Returns: boolean
      }
      search_chemicals: {
        Args: { query_words: string[] }
        Returns: Array<{
          id: string
          cas_number: string | null
          common_name: string
          iupac_name: string | null
          molecular_formula: string | null
          needs_review: boolean
        }>
      }
      match_chemicals_by_names: {
        Args: { names: string[] }
        Returns: Array<{
          input_name: string
          chemical_id: string
          common_name: string
          cas_number: string | null
        }>
      }
      get_own_auth_context: {
        Args: Record<string, never>
        Returns: Array<{
          role: string
          full_name: string | null
          user_type: string
          permission_keys: string[]
          enabled_modules: string[]
        }>
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
          source: string | null
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
          source?: string | null
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
          source?: string | null
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
          chemical_id: string | null
          role: string | null
          quantity: number | null
          unit: string | null
          notes: string | null
          product_name: string | null
          alt_cas: string | null
          added_at: string
        }
        Insert: {
          id?: string
          consultation_id: string
          chemical_id?: string | null
          role?: string | null
          quantity?: number | null
          unit?: string | null
          notes?: string | null
          product_name?: string | null
          alt_cas?: string | null
        }
        Update: {
          chemical_id?: string | null
          role?: string | null
          quantity?: number | null
          unit?: string | null
          notes?: string | null
          product_name?: string | null
          alt_cas?: string | null
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
      consultation_logs: {
        Row: {
          id: string
          consultation_id: string
          user_id: string
          action: string
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          consultation_id: string
          user_id: string
          action: string
          details?: Record<string, unknown> | null
        }
        Update: {
          details?: Record<string, unknown> | null
        }
        Relationships: []
      }
      consultation_notes: {
        Row: {
          id: string
          consultation_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          consultation_id: string
          author_id: string
          content: string
        }
        Update: {
          content?: string
        }
        Relationships: []
      }
      consultation_products: {
        Row: {
          id: string
          consultation_id: string
          product_name: string
          units_per_year: number | null
          unit_size_grams: number | null
          created_at: string
        }
        Insert: {
          id?: string
          consultation_id: string
          product_name: string
          units_per_year?: number | null
          unit_size_grams?: number | null
        }
        Update: {
          units_per_year?: number | null
          unit_size_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_products_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
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
  recruitment: {
    Tables: {
      candidates: {
        Row: {
          id: string
          email: string
          secondary_email: string | null
          phone: string | null
          first_name: string
          last_name: string
          current_title: string | null
          current_employer: string | null
          employment_status: "employed" | "not_working"
          location_city: string | null
          location_state: string | null
          location_postcode: string | null
          location_country: string
          citizenship_status: string | null
          raw_resume_text: string | null
          parsed_metadata: Record<string, unknown> | null
          skills_tags: string[]
          education_tags: string[]
          field_of_study: string | null
          profile_completeness_pct: number
          completeness_prompted: boolean
          security_clearance_level: string | null
          security_clearance_verified: boolean
          security_clearance_expiry: string | null
          linkedin_url: string | null
          seek_talent_profile_url: string | null
          preferred_work_types: string[]
          current_salary: number | null
          base_salary_expected: string | null
          source_channel: ApplicationSource | null
          cv_parse_status: CvParseStatus
          cv_parsed_by: CvParsedBy | null
          cv_parsed_at: string | null
          added_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          secondary_email?: string | null
          phone?: string | null
          first_name: string
          last_name: string
          current_title?: string | null
          current_employer?: string | null
          employment_status?: "employed" | "not_working"
          location_city?: string | null
          location_state?: string | null
          location_postcode?: string | null
          location_country?: string
          citizenship_status?: string | null
          raw_resume_text?: string | null
          parsed_metadata?: Record<string, unknown> | null
          skills_tags?: string[]
          education_tags?: string[]
          field_of_study?: string | null
          security_clearance_level?: string | null
          security_clearance_verified?: boolean
          security_clearance_expiry?: string | null
          linkedin_url?: string | null
          seek_talent_profile_url?: string | null
          preferred_work_types?: string[]
          current_salary?: number | null
          base_salary_expected?: string | null
          source_channel?: ApplicationSource | null
          added_by?: string | null
          is_active?: boolean
        }
        Update: {
          email?: string
          secondary_email?: string | null
          phone?: string | null
          first_name?: string
          last_name?: string
          current_title?: string | null
          current_employer?: string | null
          employment_status?: "employed" | "not_working"
          location_city?: string | null
          location_state?: string | null
          location_postcode?: string | null
          citizenship_status?: string | null
          raw_resume_text?: string | null
          parsed_metadata?: Record<string, unknown> | null
          skills_tags?: string[]
          education_tags?: string[]
          field_of_study?: string | null
          security_clearance_level?: string | null
          security_clearance_verified?: boolean
          security_clearance_expiry?: string | null
          linkedin_url?: string | null
          seek_talent_profile_url?: string | null
          preferred_work_types?: string[]
          current_salary?: number | null
          base_salary_expected?: string | null
          cv_parse_status?: CvParseStatus
          cv_parsed_by?: CvParsedBy | null
          cv_parsed_at?: string | null
          completeness_prompted?: boolean
          is_active?: boolean
        }
        Relationships: []
      }
      candidate_notes: {
        Row: {
          id: string
          candidate_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          author_id: string
          content: string
        }
        Update: {
          content?: string
        }
        Relationships: []
      }
      candidate_documents: {
        Row: {
          id: string
          candidate_id: string
          application_id: string | null
          doc_type: "cv" | "cl"
          storage_key: string
          original_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          application_id?: string | null
          doc_type: "cv" | "cl"
          storage_key: string
          original_name?: string | null
        }
        Update: {
          application_id?: string | null
          storage_key?: string
          original_name?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string
          company_id: string
          title: string
          reference_number: string | null
          description: string | null
          requirements: string | null
          employment_type: EmploymentType | null
          location: string | null
          salary_min: number | null
          salary_max: number | null
          salary_currency: string
          contract_duration_weeks: number | null
          security_clearance_required: boolean
          vacancies_count: number
          status: JobStatus
          assigned_recruiter_id: string | null
          seek_ad_id: string | null
          wp_post_id: string | null
          wp_permalink: string | null
          is_executive_search: boolean
          confidential_mode: boolean
          narrative_copy: string | null
          hero_image_storage_key: string | null
          required_skills: string[]
          required_education_tags: string[]
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          title: string
          reference_number?: string | null
          description?: string | null
          requirements?: string | null
          employment_type?: EmploymentType | null
          location?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_currency?: string
          contract_duration_weeks?: number | null
          security_clearance_required?: boolean
          vacancies_count?: number
          status?: JobStatus
          assigned_recruiter_id?: string | null
          seek_ad_id?: string | null
          wp_post_id?: string | null
          wp_permalink?: string | null
          is_executive_search?: boolean
          confidential_mode?: boolean
          narrative_copy?: string | null
          hero_image_storage_key?: string | null
          required_skills?: string[]
          required_education_tags?: string[]
          created_by?: string | null
        }
        Update: {
          title?: string
          reference_number?: string | null
          description?: string | null
          requirements?: string | null
          employment_type?: EmploymentType | null
          location?: string | null
          salary_min?: number | null
          salary_max?: number | null
          contract_duration_weeks?: number | null
          security_clearance_required?: boolean
          vacancies_count?: number
          status?: JobStatus
          assigned_recruiter_id?: string | null
          seek_ad_id?: string | null
          wp_post_id?: string | null
          wp_permalink?: string | null
          is_executive_search?: boolean
          confidential_mode?: boolean
          narrative_copy?: string | null
          hero_image_storage_key?: string | null
          required_skills?: string[]
          required_education_tags?: string[]
        }
        Relationships: []
      }
      job_documents: {
        Row: {
          id: string
          job_id: string
          storage_key: string
          original_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          storage_key: string
          original_name?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
      job_events: {
        Row: {
          id: string
          job_id: string
          event_type: JobEventType
          previous_status: JobStatus | null
          new_status: JobStatus | null
          notes: string | null
          performed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          event_type: JobEventType
          previous_status?: JobStatus | null
          new_status?: JobStatus | null
          notes?: string | null
          performed_by: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      applications: {
        Row: {
          id: string
          job_id: string
          candidate_id: string
          source_channel: ApplicationSource
          source_metadata: Record<string, unknown> | null
          stage: ApplicationStage
          cv_storage_key: string | null
          cl_storage_key: string | null
          cv_original_name: string | null
          cl_original_name: string | null
          notes: string | null
          submitted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          candidate_id: string
          source_channel: ApplicationSource
          source_metadata?: Record<string, unknown> | null
          stage?: ApplicationStage
          cv_storage_key?: string | null
          cl_storage_key?: string | null
          cv_original_name?: string | null
          cl_original_name?: string | null
          notes?: string | null
          submitted_by?: string | null
        }
        Update: {
          stage?: ApplicationStage
          notes?: string | null
          cv_storage_key?: string | null
          cl_storage_key?: string | null
        }
        Relationships: []
      }
      application_stage_history: {
        Row: {
          id: string
          application_id: string
          from_stage: ApplicationStage | null
          to_stage: ApplicationStage
          changed_by: string | null
          notes: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          application_id: string
          from_stage?: ApplicationStage | null
          to_stage: ApplicationStage
          changed_by?: string | null
          notes?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
      application_views: {
        Row: {
          application_id: string
          viewed_by: string
          viewed_at: string
        }
        Insert: {
          application_id: string
          viewed_by: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      placements: {
        Row: {
          id: string
          application_id: string
          job_id: string
          candidate_id: string
          placement_type: PlacementType
          start_date: string
          finish_date: string | null
          pay_rate: number | null
          charge_rate: number | null
          currency: string
          salary_package: number | null
          placement_fee: number | null
          fee_type: "percentage" | "fixed" | null
          fee_percentage: number | null
          status: PlacementStatus
          confirmed_by: string | null
          confirmed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          application_id: string
          job_id: string
          candidate_id: string
          placement_type: PlacementType
          start_date: string
          finish_date?: string | null
          pay_rate?: number | null
          charge_rate?: number | null
          currency?: string
          salary_package?: number | null
          placement_fee?: number | null
          fee_type?: "percentage" | "fixed" | null
          fee_percentage?: number | null
          status?: PlacementStatus
          confirmed_by?: string | null
        }
        Update: {
          status?: PlacementStatus
          finish_date?: string | null
          pay_rate?: number | null
          charge_rate?: number | null
          placement_fee?: number | null
          fee_type?: "percentage" | "fixed" | null
          fee_percentage?: number | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          id: string
          placement_id: string
          contract_number: string | null
          document_storage_key: string | null
          document_original_name: string | null
          notice_period: string | null
          status: ContractStatus
          termination_reason: string | null
          terminated_by: string | null
          terminated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          placement_id: string
        }
        Update: {
          contract_number?: string | null
          document_storage_key?: string | null
          document_original_name?: string | null
          notice_period?: string | null
          status?: ContractStatus
          termination_reason?: string | null
          terminated_by?: string | null
          terminated_at?: string | null
        }
        Relationships: []
      }
      contract_extensions: {
        Row: {
          id: string
          contract_id: string
          previous_finish_date: string
          new_finish_date: string
          previous_pay_rate: number | null
          new_pay_rate: number | null
          previous_charge_rate: number | null
          new_charge_rate: number | null
          notes: string | null
          extended_by: string | null
          extended_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          previous_finish_date: string
          new_finish_date: string
          previous_pay_rate?: number | null
          new_pay_rate?: number | null
          previous_charge_rate?: number | null
          new_charge_rate?: number | null
          notes?: string | null
          extended_by?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          task_type: TaskType
          title: string
          description: string | null
          placement_id: string | null
          job_id: string | null
          candidate_id: string | null
          assigned_to: string | null
          assigned_by: string | null
          status: TaskStatus
          due_date: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_type: TaskType
          title: string
          description?: string | null
          placement_id?: string | null
          job_id?: string | null
          candidate_id?: string | null
          assigned_to?: string | null
          assigned_by?: string | null
          status?: TaskStatus
          due_date?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          assigned_to?: string | null
          status?: TaskStatus
          due_date?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      scheduled_emails: {
        Row: {
          id: string
          job_id: string
          application_id: string
          candidate_id: string
          task_id: string | null
          scheduled_for: string
          status: ScheduledEmailStatus
          sent_at: string | null
          error_message: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          application_id: string
          candidate_id: string
          task_id?: string | null
          scheduled_for: string
          status?: ScheduledEmailStatus
          created_by?: string | null
        }
        Update: {
          status?: ScheduledEmailStatus
          sent_at?: string | null
          error_message?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          id: string
          company_id: string
          contact_id: string | null
          title: string
          stage: OpportunityStage
          value: number | null
          currency: string
          module: OpportunityModule | null
          assigned_to: string | null
          expected_close_date: string | null
          closed_at: string | null
          close_reason: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          contact_id?: string | null
          title: string
          stage?: OpportunityStage
          value?: number | null
          currency?: string
          module?: OpportunityModule | null
          assigned_to?: string | null
          expected_close_date?: string | null
          closed_at?: string | null
          close_reason?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          title?: string
          stage?: OpportunityStage
          value?: number | null
          module?: OpportunityModule | null
          assigned_to?: string | null
          expected_close_date?: string | null
          closed_at?: string | null
          close_reason?: string | null
          notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_stagnant_applications: {
        Row: {
          application_id: string
          job_id: string
          candidate_id: string
          stage: ApplicationStage
          stage_entered_at: string
          days_in_stage: number
          job_title: string
          candidate_name: string
          candidate_email: string
        }
      }
    }
    Functions: {
      upsert_candidate: {
        Args: {
          p_email: string
          p_phone?: string | null
          p_first_name?: string | null
          p_last_name?: string | null
          p_current_title?: string | null
          p_current_employer?: string | null
          p_location_city?: string | null
          p_location_state?: string | null
          p_location_country?: string
          p_raw_resume_text?: string | null
          p_parsed_metadata?: Record<string, unknown> | null
          p_skills_tags?: string[] | null
          p_field_of_study?: string | null
          p_source_channel?: string | null
          p_added_by?: string | null
        }
        Returns: Array<{ candidate_id: string; action: string; completeness_pct: number }>
      }
      search_candidates: {
        Args: { query_text: string; lim?: number }
        Returns: Array<{
          id: string
          first_name: string
          last_name: string
          email: string
          current_title: string | null
          current_employer: string | null
          skills_tags: string[]
          rank: number
        }>
      }
      merge_candidates: {
        Args: { p_primary_id: string; p_duplicate_id: string; p_merged_by: string }
        Returns: Array<{
          primary_id: string
          duplicate_id: string
          applications_moved: number
          applications_dropped: number
          placements_moved: number
          tasks_moved: number
          notes_moved: number
          secondary_email_set: boolean
        }>
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  timesheets: {
    Tables: {
      contractors: {
        Row: {
          id: string
          user_id: string
          candidate_id: string | null
          placement_id: string | null
          company_id: string
          branch_id: string | null
          full_name: string
          email: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          candidate_id?: string | null
          placement_id?: string | null
          company_id: string
          branch_id?: string | null
          full_name: string
          email: string
          is_active?: boolean
        }
        Update: {
          candidate_id?: string | null
          placement_id?: string | null
          company_id?: string
          branch_id?: string | null
          full_name?: string
          email?: string
          is_active?: boolean
        }
        Relationships: []
      }
      supervisors: {
        Row: {
          id: string
          user_id: string
          contact_id: string | null
          company_id: string
          branch_id: string | null
          full_name: string
          email: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id?: string | null
          company_id: string
          branch_id?: string | null
          full_name: string
          email: string
          is_active?: boolean
        }
        Update: {
          contact_id?: string | null
          company_id?: string
          branch_id?: string | null
          full_name?: string
          email?: string
          is_active?: boolean
        }
        Relationships: []
      }
      supervisor_assignments: {
        Row: {
          id: string
          contractor_id: string
          supervisor_id: string
          start_date: string
          end_date: string | null
          assigned_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contractor_id: string
          supervisor_id: string
          start_date?: string
          end_date?: string | null
          assigned_by?: string | null
        }
        Update: {
          end_date?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          id: string
          contractor_id: string
          start_date: string
          finish_date: string | null
          pay_rate: number | null
          charge_rate: number | null
          currency: string
          status: ContractStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contractor_id: string
          start_date: string
          finish_date?: string | null
          pay_rate?: number | null
          charge_rate?: number | null
          currency?: string
          status?: ContractStatus
        }
        Update: {
          start_date?: string
          finish_date?: string | null
          pay_rate?: number | null
          charge_rate?: number | null
          currency?: string
          status?: ContractStatus
        }
        Relationships: []
      }
      contract_events: {
        Row: {
          id: string
          contract_id: string
          event_type: ContractEventType
          actor_user_id: string | null
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          event_type: ContractEventType
          actor_user_id?: string | null
          details?: Record<string, unknown> | null
        }
        Update: Record<string, never>
        Relationships: []
      }
      timesheets: {
        Row: {
          id: string
          contractor_id: string
          week_starting: string
          status: TimesheetStatus
          decline_reason: string | null
          is_template: boolean
          supervisor_id: string | null
          submitted_at: string | null
          approved_at: string | null
          approved_by: string | null
          declined_at: string | null
          declined_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contractor_id: string
          week_starting: string
          status?: TimesheetStatus
          decline_reason?: string | null
          is_template?: boolean
          supervisor_id?: string | null
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          declined_at?: string | null
          declined_by?: string | null
        }
        Update: {
          status?: TimesheetStatus
          decline_reason?: string | null
          supervisor_id?: string | null
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          declined_at?: string | null
          declined_by?: string | null
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          id: string
          timesheet_id: string
          work_date: string
          hours: number
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          timesheet_id: string
          work_date: string
          hours: number
          description?: string | null
        }
        Update: {
          work_date?: string
          hours?: number
          description?: string | null
        }
        Relationships: []
      }
      timesheet_events: {
        Row: {
          id: string
          timesheet_id: string
          event_type: TimesheetEventType
          actor_user_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          timesheet_id: string
          event_type: TimesheetEventType
          actor_user_id?: string | null
          notes?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
