import dotenv from 'dotenv';
import { FeatureManager } from './services/featureManager';
import { EmailForwarder } from './services/emailForwarder';

dotenv.config();

class GmailDiscordBot {
  private featureManager: FeatureManager;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.featureManager = new FeatureManager();
    
    // メール転送機能を追加
    this.featureManager.addFeature(new EmailForwarder());
  }

  async start(): Promise<void> {
    try {
      console.log('Gmail to Discord Bot starting...');
      
      // 全ての機能を初期化
      await this.featureManager.initializeAllFeatures();
      
      // 初回実行
      // await this.featureManager.executeAllFeatures();
      
      // 定期的な実行を停止（イベント駆動のため）
      // this.checkInterval = setInterval(async () => {
      //   await this.featureManager.executeAllFeatures();
      // }, 1 * 60 * 1000);

      console.log('Bot is running and listening for new email events.');
      
      // プロセス終了時の処理
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
      
    } catch (error) {
      console.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.log('Shutting down bot...');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    await this.featureManager.shutdownAllFeatures();
    
    console.log('Bot shutdown complete');
    process.exit(0);
  }
}

// 環境変数の検証
function validateEnvironment(): void {
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CHANNEL_ID',
    'IMAP_USER',
    'IMAP_PASSWORD',
    'IMAP_HOST',
    'IMAP_PORT',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    missingVars.forEach((varName) => console.error(`  - ${varName}`));
    console.error(
      '\nPlease check your .env file and ensure all required variables are set.',
    );
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
  console.error('Fatal error:', error);
  process.exit(1);
}); 