-- ─────────────────────────────────────────────────────────────────────────────
-- IMS Computers — Dell service tag + fixed office locations
-- Migration: 20260819000003_ims_computers_service_tag_location.sql
--
-- service_tag: Dell's own warranty-lookup identifier (distinct from the
-- generic serial_number — most other device types, e.g. printers/network
-- gear, have no service tag at all). Warranty status is looked up manually
-- at https://www.dell.com/support/home/en-au using this value; no API
-- integration.
--
-- location: fleet is fixed to the 4 physical offices, so this moves from
-- free text to a constrained set, same convention as device_type/status.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ims.computers ADD COLUMN service_tag text;

ALTER TABLE ims.computers
  ADD CONSTRAINT computers_location_check
    CHECK (location IN ('Melbourne Office', 'Sydney', 'Brisbane', 'Canberra'));
