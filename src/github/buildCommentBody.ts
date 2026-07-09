import pkg from '../../package.json' with { type: 'json' };
import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { REVIEW_BOT_RETRIGGER_COMMAND } from '../types/coderabbit.js';
import { TriggerSource } from '../types/TriggerSource.js';

const { version } = pkg;
const repoUrl = pkg.repository.url;

export const buildCommentBody = (sourceCommentUrl: string, runId: string, triggerSource: TriggerSource): string => {
  let triggerLine: string;
  let sourceUrlForMetadata: string | null;

  switch (triggerSource) {
    case TriggerSource.dashboard_retrigger_now:
      triggerLine = `\u{26A1} Triggered manually from dashboard`;
      sourceUrlForMetadata = null;
      break;
    case TriggerSource.scheduler:
      triggerLine = `\u{21A9} Triggered by: ${sourceCommentUrl}`;
      sourceUrlForMetadata = sourceCommentUrl;
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
  };

  const jsonComment = `<!-- rabbit-maximizer\n${JSON.stringify(metadata, null, 2)}\n-->`;

  return [REVIEW_BOT_RETRIGGER_COMMAND, '', triggerLine, '', '---', '', footer, '', jsonComment].join('\n');
};
