ALTER TABLE review_queue ADD COLUMN cooldown_until DATETIME;
ALTER TABLE review_queue ADD COLUMN last_skipped_at DATETIME;
ALTER TABLE review_queue ADD COLUMN last_skip_reason TEXT CHECK(length(last_skip_reason) <= 25 AND last_skip_reason IN ('cooldown','settling'));
ALTER TABLE review_queue ADD COLUMN retrigger_skip_count INTEGER NOT NULL DEFAULT 0;
