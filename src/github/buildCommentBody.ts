import pkg from '../../package.json' with { type: 'json' };
import { TriggerSource } from '../domain.js';
import { RabbitMaximizerError } from '../errors/index.js';
import type { RetriggerDiagnosis } from '../types/index.js';
import { formatRelativeTime } from '../utils/index.js';

import { REVIEW_BOT_RETRIGGER_COMMAND } from './index.js';

const { version } = pkg;
const repoUrl = pkg.repository.url;
const JSON_METADATA_INDENT_SPACES = 2;

const buildDiagnosisLine = (diagnosis: RetriggerDiagnosis): string => {
  const { sourceComment, decision } = diagnosis;

  if (decision === 'direct') {
    return '\u{1F50D} Posted directly; no rate-limit comment found';
  }

  const age = formatRelativeTime(sourceComment.createdAt, { now: new Date() });
  return `\u{1F50D} Source: ${sourceComment.classification} comment from ${age}`;
};

export const buildCommentBody = (
  sourceCommentUrl: string | undefined,
  runId: string,
  triggerSource: TriggerSource,
  diagnosis: RetriggerDiagnosis | undefined,
): string => {
  let triggerLine: string;
  let sourceUrlForMetadata: string | null;

  switch (triggerSource) {
    case TriggerSource.dashboard_retrigger_now:
      triggerLine = '\u{26A1} Triggered manually from dashboard';
      sourceUrlForMetadata = null;
      break;
    case TriggerSource.scheduler:
      triggerLine = sourceCommentUrl ? `\u{21A9} Triggered by: ${sourceCommentUrl}` : '\u{21A9} Triggered by scheduler';
      sourceUrlForMetadata = sourceCommentUrl ?? null;
      break;
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('triggerSource', triggerSource, 'buildCommentBody');
  }

  const footer = `\u{1F916} [rabbit-maximizer](${repoUrl}) v${version} — run=${runId}`;

  const metadata = {
    version,
    runId,
    triggerSource,
    sourceCommentUrl: sourceUrlForMetadata,
    timestamp: new Date().toISOString(),
    ...(diagnosis ? { diagnosis } : {}),
  };

  const rawJson = JSON.stringify(metadata, null, JSON_METADATA_INDENT_SPACES);
  const safeJson = rawJson.replace(/-->/g, '--\\u003E');
  const jsonComment = `<!-- rabbit-maximizer\n${safeJson}\n-->`;

  const lines = [REVIEW_BOT_RETRIGGER_COMMAND, '', triggerLine];

  if (diagnosis) {
    lines.push(buildDiagnosisLine(diagnosis));
  }

  lines.push('', '---', '', footer, '', jsonComment);

  return lines.join('\n');
};
