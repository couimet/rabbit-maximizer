import pkg from '../../package.json' with { type: 'json' };
import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { REVIEW_BOT_RETRIGGER_COMMAND } from '../types/coderabbit.js';
import { TriggerSource } from '../types/TriggerSource.js';

const { version } = pkg;
const repoUrl = pkg.repository.url;

export const buildCommentBody = (sourceCommentUrl: string, runId: string, triggerSource: TriggerSource): string => {
  let marker: string;
  let triggerLine: string;

  switch (triggerSource) {
    case TriggerSource.dashboard_retrigger_now:
      marker = `\u{1F527} rabbit-maximizer v${version} run=${runId} [manual]`;
      triggerLine = `\u{26A1} Triggered manually from dashboard`;
      break;
    case TriggerSource.scheduler:
      marker = `\u{1F527} rabbit-maximizer v${version} run=${runId}`;
      triggerLine = `\u{21A9} Triggered by: ${sourceCommentUrl}`;
      break;
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('triggerSource', triggerSource, 'buildCommentBody');
  }

  const footer = [`\u{1F916} rabbit-maximizer | ${repoUrl} | v${version} | run=${runId}`, triggerLine].join('\n');

  return [REVIEW_BOT_RETRIGGER_COMMAND, '', marker, '', '---', '', footer].join('\n');
};
