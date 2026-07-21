-- ─────────────────────────────────────────────────────────────────────────────
-- Locked "Super Admin" group — makes super_admin status visible/manageable in
-- the User Groups UI, auto-synced from profiles.role. This group is purely a
-- read-only mirror: it grants NO permissions on its own. Every authorization
-- check in this app (is_admin(), has_module_access(), is_module_admin(), and
-- the app-layer hasPermission()/requirePermissionOrSuperAdmin()) continues to
-- check profiles.role directly — none of them consult this group's
-- membership. That's deliberate: even if this group's membership were ever
-- tampered with, it would grant nothing, because nothing reads it for
-- authorization. The only real lever for super-admin status remains
-- PATCH /api/users/[userId] (role field), already super-admin-only to call
-- and already blocked from self-demotion.
-- Migration: 20260722000001_locked_super_admin_group.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_groups ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

INSERT INTO public.user_groups (name, description, is_locked) VALUES
  ('Super Admin', 'Automatically includes every super_admin user. Managed via each user''s Role field — not editable here.', true)
ON CONFLICT (name) DO NOTHING;

-- Backfill: every current super_admin becomes a member immediately.
INSERT INTO public.user_group_members (group_id, user_id)
SELECT g.id, p.id
FROM public.profiles p
JOIN public.user_groups g ON g.name = 'Super Admin'
WHERE p.role = 'super_admin'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- ─── Sync trigger: keep Super Admin group membership mirroring profiles.role ──

CREATE OR REPLACE FUNCTION sync_super_admin_group()
RETURNS trigger AS $$
DECLARE
  sa_group_id uuid;
BEGIN
  SELECT id INTO sa_group_id FROM public.user_groups WHERE name = 'Super Admin';
  IF sa_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'super_admin' THEN
    INSERT INTO public.user_group_members (group_id, user_id)
    VALUES (sa_group_id, NEW.id)
    ON CONFLICT (group_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.user_group_members
    WHERE group_id = sa_group_id AND user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_super_admin_group_membership ON public.profiles;
CREATE TRIGGER sync_super_admin_group_membership
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION sync_super_admin_group();

-- ─── Lock enforcement (defense in depth — API routes are the primary guard) ──

CREATE OR REPLACE FUNCTION prevent_locked_group_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked THEN
      RAISE EXCEPTION 'This group is locked and cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSE
    IF OLD.is_locked AND (
      NEW.name IS DISTINCT FROM OLD.name
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.is_locked IS DISTINCT FROM OLD.is_locked
    ) THEN
      RAISE EXCEPTION 'This group is locked and cannot be modified.';
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_user_groups ON public.user_groups;
CREATE TRIGGER lock_user_groups
  BEFORE UPDATE OR DELETE ON public.user_groups
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_group_mutation();

CREATE OR REPLACE FUNCTION prevent_locked_group_permission_mutation()
RETURNS trigger AS $$
DECLARE
  target_group_id uuid := COALESCE(NEW.group_id, OLD.group_id);
  locked boolean;
BEGIN
  SELECT is_locked INTO locked FROM public.user_groups WHERE id = target_group_id;
  IF locked THEN
    RAISE EXCEPTION 'Permissions for this group are locked and cannot be modified.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_user_group_permissions ON public.user_group_permissions;
CREATE TRIGGER lock_user_group_permissions
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_group_permissions
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_group_permission_mutation();
