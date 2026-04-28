import { Controller, Get, Inject, Post, Query, Body, Config } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { InjectDataSource } from '@midwayjs/typeorm';
import { RedisService } from '@midwayjs/redis';
import { HttpService } from '@midwayjs/axios';
import { DataSource } from 'typeorm';
import { Validate } from '@midwayjs/validate';
import { WeworkApiService } from '../service/wework-api.service';
import { AcquisitionChannelScanTestDto } from '../dto/integration-test.dto';

function allowIntegrationTestRoutes(): boolean {
  if (process.env.ENABLE_INTEGRATION_TEST_ROUTES === '0') {
    return false;
  }
  if (process.env.ENABLE_INTEGRATION_TEST_ROUTES === '1') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

/** 从企微 XML 中取 CDATA 或纯文本子节点 */
function extractXmlField(xml: string, tag: string): string | undefined {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i').exec(xml);
  if (cdata) {
    return cdata[1].trim();
  }
  const plain = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(xml);
  return plain ? plain[1].trim() : undefined;
}

/**
 * 经网关暴露的集成服务探测（路径与 gateway /api/v1/integration/* 一致）
 */
@Controller('/api/v1/integration')
export class IntegrationApiController {
  @Inject()
  ctx!: Context;

  @InjectDataSource()
  dataSource!: DataSource;

  @Inject()
  redisService!: RedisService;

  @Inject()
  weworkApiService!: WeworkApiService;

  @Inject()
  httpService!: HttpService;

  @Config('integration')
  integrationConfig!: { acquisitionServiceUrl: string };

  @Get('/health')
  async health() {
    let database: 'connected' | 'disconnected' = 'disconnected';
    let redis: 'connected' | 'disconnected' = 'disconnected';
    let dbError: string | undefined;

    try {
      await this.dataSource.query('SELECT 1');
      database = 'connected';
    } catch (error: any) {
      dbError = error?.message || 'Unknown error';
    }

    try {
      const pingKey = 'integration:health:ping';
      await this.redisService.set(pingKey, '1', 'EX', 10);
      const v = await this.redisService.get(pingKey);
      redis = v === '1' ? 'connected' : 'disconnected';
    } catch {
      redis = 'disconnected';
    }

    const ok = database === 'connected' && redis === 'connected';
    return {
      status: ok ? 'ok' : 'error',
      service: 'integration-service',
      timestamp: new Date().toISOString(),
      database,
      redis,
      ...(dbError ? { error: dbError } : {}),
    };
  }

  /**
   * 企微回调 URL 验证（GET）
   * 文档：msg_signature = SHA1(sort([token, timestamp, nonce, echostr]))
   */
  @Get('/wework/callback')
  async weworkCallbackGet(
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string
  ) {
    if (!msgSignature || !timestamp || !nonce || !echostr) {
      this.ctx.status = 400;
      return { success: false, message: '缺少 msg_signature、timestamp、nonce 或 echostr' };
    }

    const config = await this.weworkApiService.getConfig();
    if (!config?.callbackToken || !config.encodingAesKey) {
      this.ctx.status = 503;
      return { success: false, message: '未配置企微回调 callback_token / encoding_aes_key' };
    }

    let echostrDecoded = echostr;
    try {
      echostrDecoded = decodeURIComponent(echostr);
    } catch {
      echostrDecoded = echostr;
    }

    const ok = this.weworkApiService.verifyCallbackMsgSignature(
      msgSignature,
      timestamp,
      nonce,
      echostrDecoded,
      config.callbackToken
    );
    if (!ok) {
      this.ctx.status = 403;
      return { success: false, message: 'msg_signature 校验失败' };
    }

    try {
      const plain = this.weworkApiService.decryptMessage(echostrDecoded, config.encodingAesKey, config.corpId);
      this.ctx.type = 'text/plain; charset=utf-8';
      this.ctx.body = plain;
      return;
    } catch (e: any) {
      this.ctx.status = 400;
      return { success: false, message: e?.message || 'echostr 解密失败' };
    }
  }

  /**
   * 企微推送消息（POST，text/xml）
   * 校验通过后返回明文 success（生产环境可再改为加密回包）
   */
  @Post('/wework/callback')
  async weworkCallbackPost() {
    const config = await this.weworkApiService.getConfig();
    if (!config?.callbackToken || !config.encodingAesKey) {
      this.ctx.status = 503;
      return { success: false, message: '未配置企微回调 callback_token / encoding_aes_key' };
    }

    const raw = this.ctx.request.body;
    const xml = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : '';

    if (!xml || xml[0] !== '<') {
      this.ctx.status = 400;
      return { success: false, message: '期望 text/xml 请求体' };
    }

    const encrypt = extractXmlField(xml, 'Encrypt');
    const timestamp = extractXmlField(xml, 'TimeStamp');
    const nonce = extractXmlField(xml, 'Nonce');
    const msgSig = extractXmlField(xml, 'MsgSignature');

    if (!encrypt || !timestamp || !nonce || !msgSig) {
      this.ctx.status = 400;
      return { success: false, message: 'XML 缺少 Encrypt / TimeStamp / Nonce / MsgSignature' };
    }

    const ok = this.weworkApiService.verifyCallbackMsgSignature(msgSig, timestamp, nonce, encrypt, config.callbackToken);
    if (!ok) {
      this.ctx.status = 403;
      return { success: false, message: 'MsgSignature 校验失败' };
    }

    try {
      this.weworkApiService.decryptMessage(encrypt, config.encodingAesKey, config.corpId);
    } catch (e: any) {
      this.ctx.status = 400;
      return { success: false, message: e?.message || 'Encrypt 解密失败' };
    }

    this.ctx.type = 'text/plain; charset=utf-8';
    this.ctx.body = 'success';
    return;
  }

  /**
   * Sprint 5 联调：模拟「集成侧收到扫码事件」后回写 acquisition（转发同用户的 Bearer）。
   * 仅当 `ENABLE_INTEGRATION_TEST_ROUTES=1` 或 `NODE_ENV=local` 时开放。
   */
  @Post('/test/acquisition-channel-scan')
  @Validate()
  async testAcquisitionChannelScan(@Body() body: AcquisitionChannelScanTestDto) {
    if (!allowIntegrationTestRoutes()) {
      this.ctx.status = 404;
      return { success: false, message: '未启用测试路由' };
    }
    const auth = this.ctx.get('authorization');
    if (!auth) {
      this.ctx.status = 401;
      return { success: false, message: '需要 Authorization' };
    }
    const base = this.integrationConfig?.acquisitionServiceUrl || 'http://localhost:7003';
    const url = `${base.replace(/\/$/, '')}/api/v1/acquisition/channel-codes/${body.channelCodeId}/ingest-scan`;
    const res = await this.httpService.post(
      url,
      { externalEventId: body.externalEventId },
      {
        headers: {
          authorization: auth,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );
    this.ctx.status = res.status;
    return res.data;
  }
}
