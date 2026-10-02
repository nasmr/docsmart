-- 0002 The Word rendering of each draft version, as an evidence hash (decision 0006). Set when the
-- version is created, like every other column of this append-only table. Versions recorded before
-- this migration have none.
ALTER TABLE draft_versions ADD COLUMN rendering_sha256 text CHECK (rendering_sha256 ~ '^[0-9a-f]{64}$');
