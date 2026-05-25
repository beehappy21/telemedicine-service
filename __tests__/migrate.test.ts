import { runMigrations } from '../scripts/migrate';
import { Client } from 'pg';
import * as fs from 'fs';

jest.mock('pg');
jest.mock('fs');

const MockClient = Client as jest.MockedClass<typeof Client>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('runMigrations', () => {
  let mockConnect: jest.Mock;
  let mockQuery: jest.Mock;
  let mockEnd: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConnect = jest.fn().mockResolvedValue(undefined);
    mockQuery = jest.fn().mockResolvedValue({});
    mockEnd = jest.fn().mockResolvedValue(undefined);

    MockClient.mockImplementation(() => ({
      connect: mockConnect,
      query: mockQuery,
      end: mockEnd,
    } as never));
  });

  it('connects, reads the migration SQL, and executes it', async () => {
    mockFs.readFileSync.mockReturnValue('CREATE TABLE test;' as never);

    await runMigrations('postgresql://test');

    expect(mockConnect).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith('CREATE TABLE test;');
    expect(mockEnd).toHaveBeenCalled();
  });

  it('calls client.end() even when query throws', async () => {
    mockFs.readFileSync.mockReturnValue('BAD SQL;' as never);
    mockQuery.mockRejectedValueOnce(new Error('syntax error'));

    await expect(runMigrations('postgresql://test')).rejects.toThrow('syntax error');

    expect(mockEnd).toHaveBeenCalled();
  });
});
