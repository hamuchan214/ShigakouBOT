import { GmailService } from './gmailService';
import { DiscordService } from './discordService';
import { EmailData } from '../types';
import { BotFeature } from '../types/botFeatures';

export class EmailForwarder implements BotFeature {
  public readonly name = 'emailForwarder';
  private gmailService: GmailService;
  private discordService: DiscordService;
  private processedEmails: Set<string> = new Set();

  constructor(gmailService?: GmailService, discordService?: DiscordService) {
    this.gmailService = gmailService || new GmailService();
    this.discordService = discordService || new DiscordService();
  }

  async initialize(): Promise<void> {
    await this.discordService.initialize();
  }

  async execute(): Promise<void> {
    try {
      console.log('Checking for new emails...');
      
      const emails = await this.gmailService.getAllMessages();
      
      for (const email of emails) {
        // 既に処理済みのメールはスキップ
        if (this.processedEmails.has(email.id)) {
          continue;
        }
        
        console.log(`Processing email: ${email.subject}`);
        
        // Discordに送信
        await this.discordService.sendEmailNotification(email);
        
        // 処理済みとしてマーク
        this.processedEmails.add(email.id);
        
        // 処理済みメールの数を制限（メモリリーク防止）
        if (this.processedEmails.size > 1000) {
          const firstKey = this.processedEmails.values().next().value;
          if (firstKey) {
            this.processedEmails.delete(firstKey);
          }
        }
      }
      
      if (emails.length > 0) {
        console.log(`Processed ${emails.length} new email(s)`);
      } else {
        console.log('No new emails found');
      }
      
    } catch (error) {
      console.error('Error checking emails:', error);
    }
  }

  async shutdown(): Promise<void> {
    await this.discordService.disconnect();
  }

  // 後方互換性のためのメソッド
  async checkAndForwardEmails(): Promise<void> {
    return this.execute();
  }
} 