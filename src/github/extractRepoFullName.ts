import { RabbitOptimizerError } from '../errors/RabbitOptimizerError.js';
import { RabbitOptimizerErrorCodes } from '../errors/RabbitOptimizerErrorCodes.js';

const PREFIX = 'https://api.github.com/repos/';

export const extractRepoFullName = (repositoryUrl: string): string => {
  if (!repositoryUrl.startsWith(PREFIX)) {
    throw new RabbitOptimizerError({
      code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
      message: 'Invalid repository URL format',
      functionName: 'extractRepoFullName',
      details: { repositoryUrl },
    });
  }
  return repositoryUrl.slice(PREFIX.length);
};
