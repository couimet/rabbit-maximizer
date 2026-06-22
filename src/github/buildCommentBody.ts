import pkg from '../../package.json' with { type: 'json' };
import { REVIEW_BOT_RETRIGGER_COMMAND } from '../types/coderabbit.js';

const { version } = pkg;
const repoUrl = pkg.repository.url;

export const buildCommentBody = (sourceCommentUrl: string, runId: string): string => {
  const marker = `\u{1F527} rabbit-maximizer v${version} run=${runId}`;
  const footer = [`\u{1F916} rabbit-maximizer | ${repoUrl} | v${version} | run=${runId}`, `\u{21A9} Triggered by: ${sourceCommentUrl}`].join('\n');

  return [REVIEW_BOT_RETRIGGER_COMMAND, '', marker, '', '---', '', footer].join('\n');
};
