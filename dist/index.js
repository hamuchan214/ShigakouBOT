"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const featureManager_1 = require("./services/featureManager");
const emailForwarder_1 = require("./services/emailForwarder");
dotenv_1.default.config();
class GmailDiscordBot {
    constructor() {
        this.checkInterval = null;
        this.featureManager = new featureManager_1.FeatureManager();
        // メール転送機能を追加
        this.featureManager.addFeature(new emailForwarder_1.EmailForwarder());
    }
    async start() {
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
        }
        catch (error) {
            console.error('Failed to start bot:', error);
            process.exit(1);
        }
    }
    async shutdown() {
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
function validateEnvironment() {
    const requiredEnvVars = [
        'DISCORD_TOKEN',
        'DISCORD_CHANNEL_ID',
        'IMAP_USER',
        'IMAP_PASSWORD',
        'IMAP_HOST',
        'IMAP_PORT',
    ];
    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error('Missing required environment variables:');
        missingVars.forEach((varName) => console.error(`  - ${varName}`));
        console.error('\nPlease check your .env file and ensure all required variables are set.');
        process.exit(1);
    }
}
// アプリケーション開始
async function main() {
    validateEnvironment();
    const bot = new GmailDiscordBot();
    await bot.start();
}
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map