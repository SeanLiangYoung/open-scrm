import { Provide, Inject, Config } from '@midwayjs/core';
import { HttpService } from '@midwayjs/axios';
import { RedisService } from '@midwayjs/redis';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { WeworkConfigEntity } from '../entity/wework-config.entity';
import { CreateWeworkConfigDto, UpdateWeworkConfigDto } from '../dto/wework-config.dto';
import * as crypto from 'crypto';

/**
 * 企业微信API服务
 */
@Provide()
export class WeworkApiService {
  @Inject()
  httpService!: HttpService;

  @Inject()
  redisService!: RedisService;

  @InjectEntityModel(WeworkConfigEntity)
  configRepository!: Repository<WeworkConfigEntity>;

  @Config('wework')
  weworkConfig: any;

  /**
   * 获取配置
   */
  async getConfig(): Promise<WeworkConfigEntity | null> {
    return await this.configRepository.findOne({
      where: { status: 1 },
      order: { createTime: 'DESC' },
    });
  }

  /**
   * 创建配置
   */
  async createConfig(dto: CreateWeworkConfigDto): Promise<WeworkConfigEntity> {
    const config = this.configRepository.create({
      corpId: dto.corpId,
      corpSecret: dto.corpSecret,
      agentId: dto.agentId,
      callbackToken: dto.token,
      encodingAesKey: dto.encodingAesKey,
      status: dto.enabled ? 1 : 0,
    });
    return await this.configRepository.save(config);
  }

  /**
   * 更新配置
   */
  async updateConfig(id: string, dto: UpdateWeworkConfigDto): Promise<WeworkConfigEntity> {
    const config = await this.configRepository.findOne({ where: { id: parseInt(id) } });
    if (!config) {
      throw new Error('配置不存在');
    }

    if (dto.corpSecret !== undefined) config.corpSecret = dto.corpSecret;
    if (dto.agentId !== undefined) config.agentId = dto.agentId;
    if (dto.token !== undefined) config.callbackToken = dto.token;
    if (dto.encodingAesKey !== undefined) config.encodingAesKey = dto.encodingAesKey;
    if (dto.enabled !== undefined) config.status = dto.enabled ? 1 : 0;

    config.updateTime = new Date();
    return await this.configRepository.save(config);
  }

  /**
   * 删除配置
   */
  async deleteConfig(id: string): Promise<void> {
    await this.configRepository.delete(parseInt(id));
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, message: '配置不存在' };
      }

      // 尝试获取Access Token
      const accessToken = await this.getAccessToken(config.corpId);
      if (accessToken) {
        return { success: true, message: '连接成功' };
      }
      return { success: false, message: '获取Access Token失败' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Unknown error' };
    }
  }

  /**
   * 获取Access Token
   */
  async getAccessToken(corpId?: string, secretType: 'corp' | 'contact' | 'customer' = 'corp'): Promise<string> {
    // 如果没有传入corpId，从配置中获取
    if (!corpId) {
      const config = await this.getConfig();
      if (!config) {
        throw new Error('企业微信配置不存在');
      }
      corpId = config.corpId;
    }
    // 从Redis缓存获取
    const cacheKey = `wework:token:${corpId}:${secretType}`;
    const cachedToken = await this.redisService.get(cacheKey);
    if (cachedToken) {
      return cachedToken;
    }

    // 获取配置
    const config = await this.configRepository.findOne({
      where: { corpId, status: 1 },
    });

    if (!config) {
      throw new Error('企业微信配置不存在');
    }

    // 选择对应的Secret
    let secret: string;
    switch (secretType) {
      case 'contact':
        secret = config.contactSecret;
        break;
      case 'customer':
        secret = config.customerSecret;
        break;
      default:
        secret = config.corpSecret;
    }

    if (!secret) {
      throw new Error(`${secretType} Secret未配置`);
    }

    // 请求Access Token
    const url = `${this.weworkConfig.apiBaseUrl}/cgi-bin/gettoken`;
    const response = await this.httpService.get(url, {
      params: {
        corpid: corpId,
        corpsecret: secret,
      },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`获取Access Token失败: ${response.data.errmsg}`);
    }

    const accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 7200;

    // 缓存Token（提前5分钟过期）
    await this.redisService.set(cacheKey, accessToken, 'EX', expiresIn - 300);

    return accessToken;
  }

  /**
   * 获取部门列表
   */
  async getDepartmentList(corpId: string, departmentId?: number) {
    const accessToken = await this.getAccessToken(corpId, 'contact');
    const url = `${this.weworkConfig.apiBaseUrl}/cgi-bin/department/list`;
    
    const response = await this.httpService.get(url, {
      params: {
        access_token: accessToken,
        id: departmentId,
      },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`获取部门列表失败: ${response.data.errmsg}`);
    }

    return response.data.department;
  }

  /**
   * 获取部门成员
   */
  async getDepartmentUsers(corpId: string, departmentId: number) {
    const accessToken = await this.getAccessToken(corpId, 'contact');
    const url = `${this.weworkConfig.apiBaseUrl}/cgi-bin/user/list`;
    
    const response = await this.httpService.get(url, {
      params: {
        access_token: accessToken,
        department_id: departmentId,
      },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`获取部门成员失败: ${response.data.errmsg}`);
    }

    return response.data.userlist;
  }

  /**
   * 获取客户列表
   */
  async getExternalContactList(corpId: string, userId: string) {
    const accessToken = await this.getAccessToken(corpId, 'customer');
    const url = `${this.weworkConfig.apiBaseUrl}/cgi-bin/externalcontact/list`;
    
    const response = await this.httpService.get(url, {
      params: {
        access_token: accessToken,
        userid: userId,
      },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`获取客户列表失败: ${response.data.errmsg}`);
    }

    return response.data.external_userid;
  }

  /**
   * 获取客户详情
   */
  async getExternalContactDetail(corpId: string, externalUserId: string) {
    const accessToken = await this.getAccessToken(corpId, 'customer');
    const url = `${this.weworkConfig.apiBaseUrl}/cgi-bin/externalcontact/get`;
    
    const response = await this.httpService.get(url, {
      params: {
        access_token: accessToken,
        external_userid: externalUserId,
      },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`获取客户详情失败: ${response.data.errmsg}`);
    }

    return response.data.external_contact;
  }

  /**
   * 发送应用消息
   */
  async sendMessage(corpId: string, message: any) {
    const accessToken = await this.getAccessToken(corpId, 'corp');
    const url = `${this.weworkConfig.apiBaseUrl}/cgi-bin/message/send?access_token=${accessToken}`;
    
    const response = await this.httpService.post(url, message);

    if (response.data.errcode !== 0) {
      throw new Error(`发送消息失败: ${response.data.errmsg}`);
    }

    return response.data;
  }

  /**
   * 发送客户消息
   */
  async sendExternalContactMessage(corpId: string, message: any) {
    const accessToken = await this.getAccessToken(corpId, 'customer');
    const url = `${this.weworkConfig.apiBaseUrl}/cgi-bin/externalcontact/message/send?access_token=${accessToken}`;
    
    const response = await this.httpService.post(url, message);

    if (response.data.errcode !== 0) {
      throw new Error(`发送客户消息失败: ${response.data.errmsg}`);
    }

    return response.data;
  }

  /**
   * 验证回调URL
   */
  verifyCallbackUrl(signature: string, timestamp: string, nonce: string, token: string): boolean {
    const arr = [token, timestamp, nonce].sort();
    const str = arr.join('');
    const sha1 = crypto.createHash('sha1');
    sha1.update(str);
    return sha1.digest('hex') === signature;
  }

  /**
   * 解密回调消息
   */
  decryptMessage(encryptedMsg: string, encodingAesKey: string, corpId: string): string {
    // 实现AES解密逻辑
    // 这里简化处理，实际需要完整的加解密实现
    return encryptedMsg;
  }
}

