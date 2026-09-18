import { injectable } from 'inversify';

@injectable()
export class RunIdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
