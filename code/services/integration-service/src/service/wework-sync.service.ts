import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { WeworkApiService } from './wework-api.service';
import { SyncLogEntity } from '../entity/sync-log.entity';
import { QuerySyncLogDto } from '../dto/sync.dto';

/**
 * 企业微信同步服务
 */
@Provide()
export class WeworkSyncService {
  @Inject()
  weworkApiService!: WeworkApiService;

  @InjectEntityModel(SyncLogEntity)
  syncLogRepository!: Repository<SyncLogEntity>;

  // 同步状态标记
  private syncingStatus: Map<string, boolean> = new Map();

  /**
   * 触发同步
   */
  async triggerSync(
    syncType: 'department' | 'user' | 'customer' | 'full',
    force = false
  ): Promise<{ success: boolean; message: string }> {
    const config = await this.weworkApiService.getConfig();
    if (!config) {
      throw new Error('企业微信配置不存在');
    }

    const corpId = config.corpId;
    const syncKey = `${corpId}:${syncType}`;

    // 检查是否正在同步
    if (this.syncingStatus.get(syncKey)) {
      return { success: false, message: '同步任务正在进行中' };
    }

    try {
      this.syncingStatus.set(syncKey, true);

      switch (syncType) {
        case 'department':
          await this.syncDepartments();
          break;
        case 'user':
          await this.syncUsers();
          break;
        case 'customer':
          await this.syncCustomers();
          break;
        case 'full':
          await this.syncDepartments();
          await this.syncUsers();
          await this.syncCustomers();
          break;
      }

      return { success: true, message: '同步完成' };
    } finally {
      this.syncingStatus.set(syncKey, false);
    }
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<{
    syncing: boolean;
    lastSync: Date | null;
    syncTypes: string[];
  }> {
    const config = await this.weworkApiService.getConfig();
    if (!config) {
      return { syncing: false, lastSync: null, syncTypes: [] };
    }

    const corpId = config.corpId;
    const syncingTypes: string[] = [];
    
    // 检查所有同步类型的状态
    ['department', 'user', 'customer', 'full'].forEach(type => {
      if (this.syncingStatus.get(`${corpId}:${type}`)) {
        syncingTypes.push(type);
      }
    });

    // 获取最后同步时间
    const lastSyncLog = await this.syncLogRepository.findOne({
      where: { corpId },
      order: { createTime: 'DESC' },
    });

    return {
      syncing: syncingTypes.length > 0,
      lastSync: lastSyncLog?.endTime || null,
      syncTypes: syncingTypes,
    };
  }

  /**
   * 同步部门
   */
  async syncDepartments(): Promise<{ success: boolean; count: number }> {
    const config = await this.weworkApiService.getConfig();
    if (!config) {
      throw new Error('企业微信配置不存在');
    }

    const corpId = config.corpId;
    const syncLog = this.syncLogRepository.create({
      corpId,
      syncType: 'department',
      status: 2,
      startTime: new Date(),
    });
    await this.syncLogRepository.save(syncLog);

    try {
      const departments = await this.weworkApiService.getDepartmentList(corpId);
      
      // TODO: 调用 user-service 保存部门数据
      
      syncLog.status = 1;
      syncLog.totalCount = departments.length;
      syncLog.successCount = departments.length;
      syncLog.endTime = new Date();
      await this.syncLogRepository.save(syncLog);

      return { success: true, count: departments.length };
    } catch (error: any) {
      syncLog.status = 0;
      syncLog.endTime = new Date();
      syncLog.errorMessage = error.message;
      await this.syncLogRepository.save(syncLog);
      throw error;
    }
  }

  /**
   * 同步员工
   */
  async syncUsers(): Promise<{ success: boolean; count: number }> {
    const config = await this.weworkApiService.getConfig();
    if (!config) {
      throw new Error('企业微信配置不存在');
    }

    const corpId = config.corpId;
    const syncLog = this.syncLogRepository.create({
      corpId,
      syncType: 'user',
      status: 2,
      startTime: new Date(),
    });
    await this.syncLogRepository.save(syncLog);

    try {
      let totalUsers = 0;
      const departments = await this.weworkApiService.getDepartmentList(corpId);
      
      for (const dept of departments) {
        const users = await this.weworkApiService.getDepartmentUsers(corpId, dept.id);
        totalUsers += users.length;
        
        // TODO: 调用 user-service 保存员工数据
      }

      syncLog.status = 1;
      syncLog.totalCount = totalUsers;
      syncLog.successCount = totalUsers;
      syncLog.endTime = new Date();
      await this.syncLogRepository.save(syncLog);

      return { success: true, count: totalUsers };
    } catch (error: any) {
      syncLog.status = 0;
      syncLog.endTime = new Date();
      syncLog.errorMessage = error.message;
      await this.syncLogRepository.save(syncLog);
      throw error;
    }
  }

  /**
   * 同步通讯录（已废弃，使用 syncDepartments 和 syncUsers）
   */
  async syncContacts(corpId: string) {
    // 创建同步日志
    const syncLog = this.syncLogRepository.create({
      corpId,
      syncType: 'contact',
      status: 2, // 进行中
      startTime: new Date(),
    });
    await this.syncLogRepository.save(syncLog);

    try {
      let successCount = 0;
      let failCount = 0;

      // 获取所有部门
      const departments = await this.weworkApiService.getDepartmentList(corpId);
      
      // 遍历部门获取成员
      for (const dept of departments) {
        try {
          const users = await this.weworkApiService.getDepartmentUsers(corpId, dept.id);
          
          // 这里应该调用user-service保存用户数据
          // 暂时只统计数量
          successCount += users.length;
        } catch (error: any) {
          failCount++;
          console.error(`同步部门${dept.id}失败:`, error);
        }
      }

      // 更新同步日志
      syncLog.status = failCount > 0 ? 0 : 1;
      syncLog.totalCount = successCount + failCount;
      syncLog.successCount = successCount;
      syncLog.failCount = failCount;
      syncLog.endTime = new Date();
      await this.syncLogRepository.save(syncLog);

      return {
        success: true,
        totalCount: syncLog.totalCount,
        successCount,
        failCount,
      };
    } catch (error: any) {
      // 同步失败
      syncLog.status = 0;
      syncLog.endTime = new Date();
      syncLog.errorMessage = error.message;
      await this.syncLogRepository.save(syncLog);
      
      throw error;
    }
  }

  /**
   * 同步客户（新版本）
   */
  async syncCustomers(): Promise<{ success: boolean; count: number }> {
    const config = await this.weworkApiService.getConfig();
    if (!config) {
      throw new Error('企业微信配置不存在');
    }

    const corpId = config.corpId;
    const syncLog = this.syncLogRepository.create({
      corpId,
      syncType: 'customer',
      status: 2,
      startTime: new Date(),
    });
    await this.syncLogRepository.save(syncLog);

    try {
      let totalCustomers = 0;
      
      // TODO: 从 user-service 获取所有员工ID
      // 暂时使用空数组
      const userIds: string[] = [];

      for (const userId of userIds) {
        try {
          const externalUserIds = await this.weworkApiService.getExternalContactList(corpId, userId);
          
          for (const externalUserId of externalUserIds) {
            try {
              const customer = await this.weworkApiService.getExternalContactDetail(corpId, externalUserId);
              totalCustomers++;
              
              // TODO: 调用 customer-service 保存客户数据
            } catch (error: any) {
              console.error(`同步客户${externalUserId}失败:`, error);
            }
          }
        } catch (error: any) {
          console.error(`同步用户${userId}的客户失败:`, error);
        }
      }

      syncLog.status = 1;
      syncLog.totalCount = totalCustomers;
      syncLog.successCount = totalCustomers;
      syncLog.endTime = new Date();
      await this.syncLogRepository.save(syncLog);

      return { success: true, count: totalCustomers };
    } catch (error: any) {
      syncLog.status = 0;
      syncLog.endTime = new Date();
      syncLog.errorMessage = error.message;
      await this.syncLogRepository.save(syncLog);
      throw error;
    }
  }

  /**
   * 同步客户（旧版本，保留以兼容）
   */
  async syncCustomersLegacy(corpId: string, userIds?: string[]) {
    // 创建同步日志
    const syncLog = this.syncLogRepository.create({
      corpId,
      syncType: 'customer',
      status: 2,
      startTime: new Date(),
    });
    await this.syncLogRepository.save(syncLog);

    try {
      let successCount = 0;
      let failCount = 0;

      // 如果没有指定用户，获取所有用户
      if (!userIds || userIds.length === 0) {
        // 这里应该从user-service获取所有用户ID
        // 暂时跳过
        userIds = [];
      }

      // 遍历用户获取客户
      for (const userId of userIds) {
        try {
          const externalUserIds = await this.weworkApiService.getExternalContactList(corpId, userId);
          
          // 获取每个客户的详情
          for (const externalUserId of externalUserIds) {
            try {
              const customer = await this.weworkApiService.getExternalContactDetail(corpId, externalUserId);
              
              // 这里应该调用customer-service保存客户数据
              // 暂时只统计数量
              successCount++;
            } catch (error: any) {
              failCount++;
              console.error(`同步客户${externalUserId}失败:`, error);
            }
          }
        } catch (error: any) {
          failCount++;
          console.error(`同步用户${userId}的客户失败:`, error);
        }
      }

      // 更新同步日志
      syncLog.status = failCount > 0 ? 0 : 1;
      syncLog.totalCount = successCount + failCount;
      syncLog.successCount = successCount;
      syncLog.failCount = failCount;
      syncLog.endTime = new Date();
      await this.syncLogRepository.save(syncLog);

      return {
        success: true,
        totalCount: syncLog.totalCount,
        successCount,
        failCount,
      };
    } catch (error: any) {
      syncLog.status = 0;
      syncLog.endTime = new Date();
      syncLog.errorMessage = error.message;
      await this.syncLogRepository.save(syncLog);
      
      throw error;
    }
  }

  /**
   * 获取同步日志
   */
  async getSyncLogs(query: QuerySyncLogDto) {
    const config = await this.weworkApiService.getConfig();
    if (!config) {
      return { list: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }

    const corpId = config.corpId;
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.syncLogRepository
      .createQueryBuilder('log')
      .where('log.corpId = :corpId', { corpId });

    if (query.syncType) {
      queryBuilder.andWhere('log.syncType = :syncType', { syncType: query.syncType });
    }

    if (query.status) {
      queryBuilder.andWhere('log.status = :status', { status: query.status });
    }

    if (query.startTime) {
      queryBuilder.andWhere('log.startTime >= :startTime', { startTime: query.startTime });
    }

    if (query.endTime) {
      queryBuilder.andWhere('log.endTime <= :endTime', { endTime: query.endTime });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('log.createTime', 'DESC');

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

