-- Drop the auto-insert trigger on application stage changes.
-- The API (PATCH /api/recruitment/applications/[appId]) handles all stage history
-- inserts explicitly with changed_by = user.id, so the trigger was producing a
-- duplicate NULL-changed_by row for every stage transition.
DROP TRIGGER IF EXISTS trg_log_application_stage_change ON recruitment.applications;
DROP FUNCTION IF EXISTS recruitment.log_application_stage_change();
