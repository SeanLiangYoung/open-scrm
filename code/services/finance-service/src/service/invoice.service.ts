import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { InvoiceEntity } from '../entity/invoice.entity';
import { OrderService } from './order.service';
import { CreateInvoiceDto, QueryInvoiceDto } from '../dto/invoice.dto';

@Provide()
export class InvoiceService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(InvoiceEntity)
  invoiceRepository!: Repository<InvoiceEntity>;

  @Inject()
  orderService!: OrderService;

  @Config('finance.invoice')
  invoiceConfig: any;

  async createInvoice(corpId: number, dto: CreateInvoiceDto): Promise<InvoiceEntity> {
    const order = await this.orderService.getOrderById(corpId, dto.orderId);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 2) {
      throw new Error('订单未支付，无法开票');
    }

    // 检查是否已开过票
    const existing = await this.invoiceRepository.findOne({
      where: { orderId: dto.orderId, corpId },
    });

    if (existing) {
      throw new Error('该订单已开票');
    }

    // 计算税额
    const taxRate = this.invoiceConfig.taxRate;
    const taxAmount = Number((order.actualAmount * taxRate).toFixed(2));

    const invoice = this.invoiceRepository.create({
      corpId,
      orderId: dto.orderId,
      invoiceType: dto.invoiceType,
      amount: order.actualAmount,
      taxAmount,
      taxRate,
      buyerName: dto.buyerName,
      buyerTaxNo: dto.buyerTaxNo,
      buyerAddress: dto.buyerAddress,
      buyerPhone: dto.buyerPhone,
      buyerBank: dto.buyerBank,
      buyerAccount: dto.buyerAccount,
      status: 1, // 待开票
      remark: dto.remark,
    });

    return await this.invoiceRepository.save(invoice);
  }

  async issueInvoice(corpId: number, invoiceId: number): Promise<void> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, corpId },
    });

    if (!invoice) {
      throw new Error('发票不存在');
    }

    if (invoice.status !== 1) {
      throw new Error('发票状态不允许开票');
    }

    // 生成发票号
    const invoiceNo = this.generateInvoiceNo();

    // TODO: 调用第三方开票接口
    // const invoiceUrl = await this.callThirdPartyInvoiceService(invoice);

    await this.invoiceRepository.update(
      { id: invoiceId, corpId },
      {
        invoiceNo,
        status: 2, // 已开票
        issueTime: new Date(),
        // invoiceUrl,
      }
    );
  }

  private generateInvoiceNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV${timestamp}${random}`;
  }

  async queryInvoices(corpId: number, query: QueryInvoiceDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.corpId = :corpId', { corpId });

    if (query.orderId) {
      queryBuilder.andWhere('invoice.orderId = :orderId', {
        orderId: query.orderId,
      });
    }

    if (query.invoiceNo) {
      queryBuilder.andWhere('invoice.invoiceNo = :invoiceNo', {
        invoiceNo: query.invoiceNo,
      });
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('invoice.status = :status', {
        status: query.status,
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('invoice.createTime', 'DESC');

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

