import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from '../errors/index.js';

export const splitRepo = (fullName: string): { owner: string; repo: string } => {
  const parts = fullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new RabbitMaximizerError({
      code: RabbitMaximizerErrorCodes.GITHUB_API_ERROR,
      message: 'Invalid repo fullName format',
      functionName: 'splitRepo',
      details: { fullName },
    });
  }
  const [owner, repo] = parts;
  return { owner, repo };
};
