import { expect, test, describe, afterEach } from 'bun:test';
import { createAppContext, destroyAppContext } from '@/app/composition/composition-root.ts';

describe('Composition Root', () => {
  let context: any;

  afterEach(async () => {
    if (context) {
      await destroyAppContext(context);
      context = null;
    }
  });

  test('createAppContext instantiates all services and repositories', async () => {
    context = await createAppContext({ dbPath: ':memory:' });
    
    expect(context).toBeDefined();
    expect(context.services).toBeDefined();
    expect(context.repositories).toBeDefined();
    
    expect(context.services.inventory).toBeDefined();
    expect(context.services.latency).toBeDefined();
    expect(context.services.rcon).toBeDefined();
    expect(context.services.stats).toBeDefined();
    expect(context.services.deploy).toBeDefined();
    expect(context.services.backup).toBeDefined();
    expect(context.services.updateFlow).toBeDefined();
    expect(context.services.scheduler).toBeDefined();
    expect(context.services.archive).toBeDefined();
    
    expect(context.repositories.localDb).toBeDefined();
    expect(context.repositories.sshPool).toBeDefined();
  });

  test('destroyAppContext cleans up resources without error', async () => {
    context = await createAppContext({ dbPath: ':memory:' });
    
    // We expect this to execute and resolve without throwing an error
    await expect(destroyAppContext(context)).resolves.toBeUndefined();
    context = null; // Prevent afterEach from calling it again
  });
});
