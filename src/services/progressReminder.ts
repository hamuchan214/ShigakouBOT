import { schedule, ScheduledTask } from 'node-cron';
import { BotFeature } from '../types/botFeatures';
import { DiscordService } from './discordService';

/**
 * 毎日 JST 21:00 に @everyone へ進捗報告を促すリマインダーを送信する機能
 */
export class ProgressReminder implements BotFeature {
  public name = 'progressReminder';
  private discordService: DiscordService;
  private cronJob: ScheduledTask | null = null;

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
  }

  private getChannelId(): string {
    return (
      process.env.DISCORD_PROGRESS_CHANNEL_ID ||
      process.env.DISCORD_CHANNEL_ID ||
      ''
    );
  }

  private async sendReminder(): Promise<void> {
    const channelId = this.getChannelId();
    if (!channelId) {
      console.warn(
        '[ProgressReminder] DISCORD_PROGRESS_CHANNEL_ID or DISCORD_CHANNEL_ID is not set. Skipping reminder.',
      );
      return;
    }

    try {
      await this.discordService.sendMessage(
        channelId,
        '@everyone PM9時です！進捗報告してください！ないならないって書けばOK',
      );
      console.log('[ProgressReminder] Progress report reminder sent.');
    } catch (error) {
      console.error('[ProgressReminder] Failed to send reminder:', error);
    }
  }

  public async initialize(): Promise<void> {
    const channelId = this.getChannelId();
    if (!channelId) {
      console.warn(
        '[ProgressReminder] No channel ID configured. Reminder will not run.',
      );
      return;
    }

    // 毎日 JST 19:20 に実行（テスト用）
    this.cronJob = schedule(
      '0 21 * * *',
      () => this.sendReminder(),
      { timezone: 'Asia/Tokyo' },
    );

    console.log('[ProgressReminder] Scheduled: daily at 9:00 PM JST');
  }

  public async execute(): Promise<void> {
    // 手動実行用（テストなど）
    await this.sendReminder();
  }

  public async shutdown(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[ProgressReminder] Cron job stopped.');
    }
  }
}
