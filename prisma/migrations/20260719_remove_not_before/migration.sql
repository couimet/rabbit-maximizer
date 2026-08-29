DROP INDEX IF EXISTS review_queue_status_not_before_idx;
ALTER TABLE review_queue DROP COLUMN not_before;
CREATE INDEX review_queue_status_idx ON review_queue(status);
