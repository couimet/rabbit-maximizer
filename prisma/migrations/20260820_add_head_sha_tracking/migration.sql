-- AlterTable
ALTER TABLE "pull_request" ADD COLUMN "head_sha" TEXT CHECK(length("head_sha") <= 40);
ALTER TABLE "pull_request" ADD COLUMN "reviewed_head_sha" TEXT CHECK(length("reviewed_head_sha") <= 40);
ALTER TABLE "pull_request" ADD COLUMN "head_committed_at" DATETIME;

-- CreateTable
CREATE TABLE "pull_request_sha" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pull_request_id" INTEGER NOT NULL,
    "sha" TEXT NOT NULL CHECK(length("sha") <= 40),
    "first_observed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_observed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pull_request_sha_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_request" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_sha_pull_request_id_sha_key" ON "pull_request_sha"("pull_request_id", "sha");

-- CreateIndex
CREATE INDEX "pull_request_sha_pull_request_id_idx" ON "pull_request_sha"("pull_request_id");
