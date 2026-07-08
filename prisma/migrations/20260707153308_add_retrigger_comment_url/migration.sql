-- Step 1: Add column as nullable with CHECK constraint matching source_comment_url (max 512 for GitHub comment URLs).
-- No default — only set when retrigger comment is posted.
ALTER TABLE "review_queue" ADD COLUMN "retrigger_comment_url" TEXT CHECK (length("retrigger_comment_url") <= 512);
