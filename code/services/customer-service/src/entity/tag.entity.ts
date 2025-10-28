import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('customer_tag')
export class TagEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId: number;

  @Column({ name: 'tag_name', type: 'varchar', length: 50 })
  tagName: string;

  @Column({ name: 'tag_type', type: 'tinyint', default: 1, comment: '1-来源 2-行为 3-兴趣 4-价值' })
  tagType: number;

  @Column({ name: 'tag_color', type: 'varchar', length: 10, nullable: true, comment: '标签颜色' })
  tagColor: string;

  @Column({ name: 'parent_id', type: 'int', unsigned: true, default: 0 })
  parentId: number;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'is_auto', type: 'tinyint', default: 0, comment: '是否自动打标签' })
  isAuto: number;

  @Column({ type: 'tinyint', default: 1, comment: '0-禁用 1-启用' })
  status: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}

