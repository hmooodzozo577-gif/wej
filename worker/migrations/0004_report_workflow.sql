-- Admin report workflow.
--
-- A report is not useful if the only thing an operator can do is read it.
-- These two columns let the dashboard move a report through
-- new -> triaged -> in_progress -> resolved / declined and record why,
-- without inventing a second table or touching what the traveller sent.
--
-- Additive only. `status` already existed and already defaulted to 'new'.
ALTER TABLE feedback ADD COLUMN admin_note TEXT;
ALTER TABLE feedback ADD COLUMN status_changed_at TEXT;

-- Retention already nulls a report's identifying fields after 90 days
-- (see runProductRetention). The operator's own note is not traveller data,
-- so it survives, but it is written by the operator and is the operator's
-- responsibility to keep free of anything identifying.
CREATE INDEX IF NOT EXISTS feedback_type_idx ON feedback(type, created_at);
