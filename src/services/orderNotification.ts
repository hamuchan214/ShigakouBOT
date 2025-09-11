import express, { Request, Response } from 'express';
import { BotFeature } from '../types/botFeatures';
import { DiscordService } from './discordService';
import { EmbedBuilder } from 'discord.js';

interface OrderPayload {
  department: string | null;
  itemName: string | null;
  modelNumber?: string | null;
  unitPrice: number;
  quantity: number;
  unit: string | null;
  storeName: string | null;
  itemUrl: string | null;
  notes?: string | null;
  timestamp?: string;
  applicant?: string;
}

export class OrderNotification implements BotFeature {
  public name = 'orderNotification';
  private discordService: DiscordService;
  private expressApp: express.Application;

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
    this.expressApp = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.expressApp.use(express.json());

    this.expressApp.post('/webhook/order', (req: Request, res: Response) => {
      try {
        const payload = this.validatePayload(req.body);
        console.log('Received payload (some fields might be null):', payload);

        this.sendOrderNotification(payload);

        res.status(200).send({ message: 'Webhook received' });
      } catch (error: any) {
        console.error('Error processing webhook:', error.message);
        res.status(400).send({ error: error.message });
      }
    });
  }

  // バリデーションを緩和し、型の整合性を確認する程度にする
  private validatePayload(body: any): OrderPayload {
    const {
      department = null,
      itemName = null,
      modelNumber = null,
      unitPrice = 0,
      quantity = 0,
      unit = null,
      storeName = null,
      itemUrl = null,
      notes = null,
      timestamp,
      applicant
    } = body;
    
    // 最低限itemNameがあれば通知を試みる
    if (!itemName) {
        throw new Error('itemName is required to create a notification.');
    }

    // URLが入力されている場合のみ、簡易的なチェックを行う
    if (itemUrl && typeof itemUrl !== 'string') {
        throw new Error('Invalid itemUrl format: must be a string or null');
    }

    return {
      department,
      itemName,
      modelNumber,
      unitPrice: typeof unitPrice === 'number' ? unitPrice : 0,
      quantity: typeof quantity === 'number' ? quantity : 0,
      unit,
      storeName,
      itemUrl,
      notes,
      timestamp,
      applicant
    };
  }

  private async sendOrderNotification(payload: OrderPayload): Promise<void> {
    const totalPrice = (payload.unitPrice || 0) * (payload.quantity || 0);
    const itemUrlText = payload.itemUrl ? `[商品ページ](${payload.itemUrl})` : 'N/A';


    const embed = new EmbedBuilder()
      .setTitle('📦 備品発注申請 (仮登録)')
      .setColor(0xFEE75C) // Yellow for pending/incomplete
      .setDescription('スプレッドシートの行が更新されました。\n全ての項目が入力されているか確認してください。')
      .setTimestamp(payload.timestamp ? new Date(payload.timestamp) : new Date())
      .addFields(
        { name: '部署', value: payload.department || 'N/A', inline: true },
        { name: '申請者', value: payload.applicant || '（シート直接入力）', inline: true },
        { name: '品名', value: payload.itemName || 'N/A' },
        { name: '型番', value: payload.modelNumber || 'N/A' },
        { name: '単価', value: `¥${(payload.unitPrice || 0).toLocaleString()}`, inline: true },
        { name: '数量', value: `${payload.quantity || 0} ${payload.unit || ''}`, inline: true },
        { name: '合計金額', value: `¥${totalPrice.toLocaleString()}`, inline: true },
        { name: '購入店', value: payload.storeName || 'N/A' },
        { name: 'リンク', value: itemUrlText },
      );
    
    if (payload.notes) {
        embed.addFields({ name: '備考', value: payload.notes });
    }

    const channelId = process.env.DISCORD_ORDER_CHANNEL_ID || '';
    if (!channelId) {
      console.error('DISCORD_ORDER_CHANNEL_ID is not set.');
      return;
    }

    try {
      await this.discordService.sendEmbed(channelId, embed);
      console.log(`Order notification sent for: ${payload.itemName}`);
    } catch (error) {
      console.error('Failed to send order notification to Discord:', error);
    }
  }

  public async initialize(): Promise<void> {
    const port = process.env.WEBHOOK_PORT || 3000;
    this.expressApp.listen(port, () => {
      console.log(`Webhook server listening on port ${port}`);
    });
  }

  public async execute(): Promise<void> {}
  public async shutdown(): Promise<void> {}
}
