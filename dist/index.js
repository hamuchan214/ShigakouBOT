"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const gmailService_1 = require("./services/gmailService");
const discordService_1 = require("./services/discordService");
dotenv_1.default.config();
class GmailDiscordBot {
    constructor() {
        this.checkInterval = null;
        this.processedEmails = new Set();
        this.gmailService = new gmailService_1.GmailService();
        this.discordService = new discordService_1.DiscordService();
    }
    async start() {
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
        }
        catch (error) {
            console.error('❌ Failed to start bot:', error);
            process.exit(1);
        }
    }
    async checkAndForwardEmails() {
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
            }
            else {
                console.log('No new emails found');
            }
        }
        catch (error) {
            console.error('Error checking emails:', error);
        }
    }
    async shutdown() {
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
function validateEnvironment() {
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
async function main() {
    validateEnvironment();
    const bot = new GmailDiscordBot();
    await bot.start();
}
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map