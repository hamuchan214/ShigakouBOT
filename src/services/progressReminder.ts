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

  private getTargetDate(): Date | null {
    const raw = process.env.GAKUROBO_DATE;
    if (!raw) {
      console.warn(
        '[ProgressReminder] GAKUROBO_DATE is not set. Countdown message will use a placeholder.',
      );
      return null;
    }

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      console.warn(
        `[ProgressReminder] GAKUROBO_DATE is invalid (${raw}). Expected ISO like 2026-11-01T09:00:00+09:00`,
      );
      return null;
    }
    return d;
  }

  private buildCountdownMessage(): string | null {
    const target = this.getTargetDate();
    const now = new Date();

    if (!target) {
      return '@学ロボ二次ビデオ審査提出までのカウントダウン設定(GAKUROBO_DATE)がされていません。環境変数を確認してください。';
    }

    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) {
      // 二次ビデオ審査の締切を過ぎたら何も投稿しない
      return null;
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}日`);
    if (hours > 0) parts.push(`${hours}時間`);
    if (minutes > 0) parts.push(`${minutes}分`);

    const remainText = parts.length > 0 ? parts.join('') : '1分未満';

    return `学ロボ二次ビデオ審査の提出締切まで残り ${remainText} です。`;
  }

  private async sendReminder(): Promise<void> {
    const channelId = this.getChannelId();
    if (!channelId) {
      console.warn(
        '[ProgressReminder] DISCORD_PROGRESS_CHANNEL_ID or DISCORD_CHANNEL_ID is not set. Skipping reminder.',
      );
      return;
    }

    const message = this.buildCountdownMessage();
    if (!message) {
      console.log('[ProgressReminder] Countdown is over. No message sent.');
      return;
    }

    try {
      await this.discordService.sendMessage(channelId, message);
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

    // 12時間ごとに実行（JST, 0時・12時）
    this.cronJob = schedule(
      '0 */12 * * *',
      () => this.sendReminder(),
      { timezone: 'Asia/Tokyo' },
    );

    console.log('[ProgressReminder] Scheduled: every 12 hours (JST, 0:00 & 12:00)');

    // 起動時に一度だけ現在の残り時間を投稿
    await this.sendReminder();
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
