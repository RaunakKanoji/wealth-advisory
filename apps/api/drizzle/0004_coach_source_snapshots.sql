ALTER TABLE coach_runs ADD COLUMN source_records_json jsonb NOT NULL DEFAULT '[]'::jsonb;
