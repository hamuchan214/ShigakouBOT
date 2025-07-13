import dotenv from 'dotenv';
import { GmailService } from './services/gmailService';
import { DiscordService } from './services/discordService';

dotenv.config();

class GmailDiscordBot {
  private gmailService: GmailService;
  private discordService: DiscordService;
  private checkInterval: NodeJS.Timeout | null = null;
  private processedEmails: Set<string> = new Set();

  constructor() {
    this.gmailService = new GmailService();
    this.discordService = new DiscordService();
  }

  async start(): Promise<void> {
    try {
      console.log('Gmail to Discord Bot starting...');
      

      await this.discordService.initialize();
      
      // 初回チェック
      await this.checkAndForwardEmails();
      
      // 定期的なチェックを開始（1分ごと）
      this.checkInterval = setInterval(async () => {
        await this.checkAndForwardEmails();
      }, 1 * 60 * 1000);

      console.log('Bot is running. Checking for new emails every 1 minute.');
      
      // プロセス終了時の処理
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
      
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }

  private async checkAndForwardEmails(): Promise<void> {
    try {
      console.log('Checking for new emails...');
      
      const emails = await this.gmailService.getUnreadMessages();
      
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

  private async shutdown(): Promise<void> {
    console.log('Shutting down bot...');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    await this.discordService.disconnect();
    
    console.log('Bot shutdown complete');
    process.exit(0);
  }
}

// 環境変数の検証
function validateEnvironment(): void {
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CHANNEL_ID',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
}

// アプリケーション開始
async function main(): Promise<void> {
  validateEnvironment();
  
  const bot = new GmailDiscordBot();
  await bot.start();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 