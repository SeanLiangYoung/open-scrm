import { describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { CustomerEntity } from './customer.entity';
import { FollowUpEntity } from './follow-up.entity';
import { TagEntity } from './tag.entity';

describe('customer PostgreSQL runtime metadata', () => {
  it('can build all service entity metadata without connecting to a database', async () => {
    const source = new DataSource({
      type: 'postgres',
      entities: [CustomerEntity, FollowUpEntity, TagEntity]
    });
    await expect((source as any).buildMetadatas()).resolves.toBeUndefined();
  });
});
