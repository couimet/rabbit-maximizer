import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill(): Promise<void> {
  const pairs = await prisma.$queryRawUnsafe<{ repo_full_name: string; pr_number: number }[]>(
    `SELECT DISTINCT repo_full_name, pr_number FROM review_queue UNION SELECT DISTINCT repo_full_name, pr_number FROM events`,
  );

  console.log(`Found ${pairs.length} distinct PRs to backfill`);

  let created = 0;
  let skipped = 0;

  for (const pair of pairs) {
    const { repo_full_name, pr_number } = pair;

    const queueRows = await prisma.reviewQueue.findMany({
      where: { repo_full_name, pr_number },
      orderBy: { created_at: 'asc' },
    });

    const firstSeenAt = queueRows[0]?.created_at ?? new Date();

    const reviewLimitRows = queueRows.filter((r) => r.source_comment_url);
    const firstReviewLimitAt = reviewLimitRows.length > 0 ? reviewLimitRows[0].created_at : null;
    const lastReviewLimitAt = reviewLimitRows.length > 0 ? reviewLimitRows[reviewLimitRows.length - 1].created_at : null;

    const retriggeredRows = queueRows.filter((r) => r.retriggered_at !== null);
    const lastReviewRequestedAt = retriggeredRows.length > 0 ? retriggeredRows[retriggeredRows.length - 1].retriggered_at! : null;
    const retriggerCount = retriggeredRows.length;

    const reviewedRows = queueRows.filter((r) => r.reviewed_at !== null);
    const lastCoderabbitReviewAt = reviewedRows.length > 0 ? reviewedRows[reviewedRows.length - 1].reviewed_at! : null;
    const reviewCount = reviewedRows.length;

    const pr = await prisma.pullRequest.create({
      data: {
        repo_full_name,
        pr_number,
        title: '<unknown>',
        author_login: '<unknown>',
        first_seen_at: firstSeenAt,
        first_review_limit_at: firstReviewLimitAt,
        last_review_limit_at: lastReviewLimitAt,
        last_review_requested_at: lastReviewRequestedAt,
        last_coderabbit_review_at: lastCoderabbitReviewAt,
        retrigger_count: retriggerCount,
        review_count: reviewCount,
      },
    });

    await prisma.reviewQueue.updateMany({
      where: { repo_full_name, pr_number },
      data: { pull_request_id: pr.id },
    });

    await prisma.events.updateMany({
      where: { repo_full_name, pr_number },
      data: { pull_request_id: pr.id },
    });

    created++;
  }

  console.log(`Created ${created} pull_request rows, skipped ${skipped} (no review-limit comment and no review activity)`);
}

backfill()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
