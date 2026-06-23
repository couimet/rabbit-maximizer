import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from '../errors/RabbitMaximizerErrorCodes.js';

const PREFIX = 'https://api.github.com/repos/';

export const extractRepoFullName = (repositoryUrl: string): string => {
  if (!repositoryUrl.startsWith(PREFIX)) {
    throw new RabbitMaximizerError({
      code: RabbitMaximizerErrorCodes.GITHUB_API_ERROR,
      message: 'Invalid repository URL format',
      functionName: 'extractRepoFullName',
      details: { repositoryUrl },
    });
  }
  return repositoryUrl.slice(PREFIX.length);
};
