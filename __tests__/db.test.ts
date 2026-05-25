import { Pool } from 'pg';
import { createPool } from '../database/db';

jest.mock('pg');
const MockPool = Pool as jest.MockedClass<typeof Pool>;

describe('createPool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns pool when first connection succeeds', async () => {
    const mockRelease = jest.fn();
    const mockConnect = jest.fn().mockResolvedValue({ release: mockRelease });
    MockPool.mockImplementation(() => ({ connect: mockConnect } as never));

    const pool = await createPool({ connectionString: 'postgresql://test', maxRetries: 3, retryDelayMs: 0 });

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalled();
    expect(pool).toBeDefined();
  });

  it('retries on transient failure then succeeds', async () => {
    const mockRelease = jest.fn();
    const mockConnect = jest.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ release: mockRelease });
    MockPool.mockImplementation(() => ({ connect: mockConnect } as never));

    const pool = await createPool({ connectionString: 'postgresql://test', maxRetries: 3, retryDelayMs: 0 });

    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(pool).toBeDefined();
  });

  it('throws after all retries are exhausted', async () => {
    const mockConnect = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    MockPool.mockImplementation(() => ({ connect: mockConnect } as never));

    await expect(
      createPool({ connectionString: 'postgresql://test', maxRetries: 3, retryDelayMs: 0 })
    ).rejects.toThrow('Failed to connect to database after 3 attempts');

    expect(mockConnect).toHaveBeenCalledTimes(3);
  });
});
