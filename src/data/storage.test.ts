import { describe, expect, it } from 'vitest';
import { withTimeout } from './storage';

describe('request timeout',()=>{
  it('returns a completed request',async()=>{
    await expect(withTimeout(Promise.resolve('ready'),50)).resolves.toBe('ready');
  });

  it('rejects a request that never settles',async()=>{
    await expect(withTimeout(new Promise(()=>{}),5,'Timed out')).rejects.toThrow('Timed out');
  });
});
