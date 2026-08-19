-- ─────────────────────────────────────────────────────────────────────────────
-- IMS (IT Inventory Management) — Core Schema
-- Migration: 20260819000001_ims_schema.sql
-- Introduces: ims.{computers, computer_logins, service_accounts, wifi_networks,
--             vpn_accounts}
--
-- Internal-staff-only module (no external contractor/supervisor concept), so
-- this follows the regulatory/recruitment RLS pattern — has_module_access('ims'),
-- single FOR ALL policy per table — not timesheets' row-owner-scoped pattern.
--
-- No secrets are ever stored in this schema. Every credential-bearing table
-- carries a `vault_reference` text field: a free-text pointer to wherever the
-- real password lives in an external password manager (e.g. "Bitwarden — IT
-- Vault / AWS Root"), never the secret itself.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS ims;

-- ─── Computers ─────────────────────────────────────────────────────────────

CREATE TABLE ims.computers (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag          text        UNIQUE,
  hostname           text        NOT NULL,
  device_type        text        NOT NULL DEFAULT 'laptop'
                       CHECK (device_type IN ('laptop', 'desktop', 'server', 'printer', 'network_device', 'mobile', 'other')),
  make               text,
  model              text,
  serial_number      text,
  assigned_to        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  location           text,
  status             text        NOT NULL DEFAULT 'in_use'
                       CHECK (status IN ('in_use', 'spare', 'in_repair', 'retired')),
  purchase_date      date,
  warranty_expiry    date,
  notes              text,
  created_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ims_computers_assigned_to ON ims.computers (assigned_to);

-- ─── Computer Logins ───────────────────────────────────────────────────────
-- OS/domain logins tied to a computer. user_id nullable — shared/service
-- logins (e.g. a generic "Reception" account) have no single owner.

CREATE TABLE ims.computer_logins (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  computer_id        uuid        NOT NULL REFERENCES ims.computers(id) ON DELETE CASCADE,
  user_id            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  login_username     text        NOT NULL,
  login_type         text        NOT NULL DEFAULT 'local'
                       CHECK (login_type IN ('local', 'domain', 'microsoft_account', 'other')),
  vault_reference    text,
  last_rotated_at    date,
  notes              text,
  created_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (computer_id, login_username)
);

CREATE INDEX idx_ims_computer_logins_computer ON ims.computer_logins (computer_id);
CREATE INDEX idx_ims_computer_logins_user ON ims.computer_logins (user_id);

-- ─── Service Accounts ──────────────────────────────────────────────────────
-- Website/service logins not tied to a computer. assigned_to nullable —
-- shared/team accounts (e.g. a company AWS root login) have no single owner.

CREATE TABLE ims.service_accounts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name       text        NOT NULL,
  service_url        text,
  account_username   text,
  assigned_to        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  vault_reference    text,
  last_rotated_at    date,
  notes              text,
  created_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_name, account_username)
);

CREATE INDEX idx_ims_service_accounts_assigned_to ON ims.service_accounts (assigned_to);

-- ─── Wifi Networks (office wifi + router controls) ────────────────────────
-- Wifi password and router admin password are different secrets, so each
-- gets its own vault_reference.

CREATE TABLE ims.wifi_networks (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ssid                        text        NOT NULL,
  location                    text,
  router_make                 text,
  router_model                text,
  router_management_ip        text,
  router_admin_username       text,
  wifi_password_vault_reference   text,
  router_admin_vault_reference    text,
  last_rotated_at             date,
  notes                       text,
  created_by                  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ─── VPN Accounts ──────────────────────────────────────────────────────────
-- One row per user per VPN endpoint (vpn_provider distinguishes multiple
-- VPN services/servers a single user might have separate credentials for).

CREATE TABLE ims.vpn_accounts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vpn_provider       text        NOT NULL DEFAULT 'default',
  vpn_username       text        NOT NULL,
  vault_reference    text,
  last_rotated_at    date,
  notes              text,
  created_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vpn_provider)
);

CREATE INDEX idx_ims_vpn_accounts_user ON ims.vpn_accounts (user_id);

-- ─── updated_at triggers ───────────────────────────────────────────────────

CREATE TRIGGER computers_updated_at
  BEFORE UPDATE ON ims.computers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER computer_logins_updated_at
  BEFORE UPDATE ON ims.computer_logins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER service_accounts_updated_at
  BEFORE UPDATE ON ims.service_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER wifi_networks_updated_at
  BEFORE UPDATE ON ims.wifi_networks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER vpn_accounts_updated_at
  BEFORE UPDATE ON ims.vpn_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────
-- Flat module-permission scoping (same as regulatory/recruitment) — write
-- authorization is enforced by permission keys in the API-route layer, not
-- by finer-grained RLS policies.

ALTER TABLE ims.computers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ims.computer_logins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ims.service_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ims.wifi_networks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ims.vpn_accounts      ENABLE ROW LEVEL SECURITY;

CREATE POLICY ims_module_access ON ims.computers
  FOR ALL TO authenticated USING (has_module_access('ims'));

CREATE POLICY ims_module_access ON ims.computer_logins
  FOR ALL TO authenticated USING (has_module_access('ims'));

CREATE POLICY ims_module_access ON ims.service_accounts
  FOR ALL TO authenticated USING (has_module_access('ims'));

CREATE POLICY ims_module_access ON ims.wifi_networks
  FOR ALL TO authenticated USING (has_module_access('ims'));

CREATE POLICY ims_module_access ON ims.vpn_accounts
  FOR ALL TO authenticated USING (has_module_access('ims'));

-- ─── Grants ────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA ims TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA ims TO authenticated, service_role;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA ims TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA ims
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ims
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- ─── module_config: widen to allow 'ims' + seed it ────────────────────────

ALTER TABLE public.module_config
  DROP CONSTRAINT module_config_module_check,
  ADD CONSTRAINT module_config_module_check
    CHECK (module IN ('regulatory', 'recruitment', 'timesheets', 'ims'));

INSERT INTO public.module_config (module) VALUES ('ims')
  ON CONFLICT (module) DO NOTHING;
