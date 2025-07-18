"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailService = void 0;
const googleapis_1 = require("googleapis");
class GmailService {
    constructor() {
        this.lastCheckedMessageId = null;
        this.lastCheckTime = null;
        this.initializeGmail();
    }
    initializeGmail() {
        const auth = new googleapis_1.google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
        auth.setCredentials({
            refresh_token: process.env.GMAIL_REFRESH_TOKEN,
        });
        this.gmail = googleapis_1.google.gmail({ version: 'v1', auth });
    }
    async getUnreadMessages() {
        try {
            // より確実な方法：最近のメールを取得して時刻でフィルタリング
            const query = '-category:promotions -category:social -category:updates -category:forums';
            console.log(`Using query: ${query}`);
            if (this.lastCheckTime) {
                console.log(`Last check time: ${this.lastCheckTime}`);
            }
            else {
                console.log(`First run`);
            }
            const response = await this.gmail.users.messages.list({
                userId: process.env.GMAIL_USER_ID || 'me',
                q: query,
                maxResults: 50, // より多くのメールを取得
            });
            console.log(`Gmail API response: ${response.data.messages?.length || 0} messages found`);
            const messages = response.data.messages || [];
            const emailData = [];
            for (const message of messages) {
                const email = await this.getMessageDetails(message.id);
                if (email && this.isNotPromotional(email)) {
                    // 初回実行時は過去1時間のメールのみを対象にする
                    const emailDate = new Date(email.date);
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    if (!this.lastCheckTime) {
                        // 初回実行時：過去1時間のメールのみ
                        if (emailDate > oneHourAgo) {
                            emailData.push(email);
                            console.log(`First run - Found recent email: ${email.subject} (${email.date})`);
                        }
                        else {
                            console.log(`First run - Skipping old email: ${email.subject} (${email.date})`);
                        }
                    }
                    else {
                        // 2回目以降：前回チェック時刻以降のメール
                        if (emailDate > this.lastCheckTime) {
                            emailData.push(email);
                            console.log(`Found new email: ${email.subject} (${email.date})`);
                        }
                        else {
                            console.log(`Skipping old email: ${email.subject} (${email.date})`);
                        }
                    }
                }
            }
            // チェック時刻を更新
            this.lastCheckTime = new Date();
            console.log(`Updated last check time to: ${this.lastCheckTime}`);
            return emailData;
        }
        catch (error) {
            console.error('Gmail API error:', error);
            return [];
        }
    }
    async getMessageDetails(messageId) {
        try {
            const response = await this.gmail.users.messages.get({
                userId: process.env.GMAIL_USER_ID || 'me',
                id: messageId,
                format: 'full',
            });
            const message = response.data;
            return this.parseMessage(message);
        }
        catch (error) {
            console.error(`Error getting message details for ${messageId}:`, error);
            return null;
        }
    }
    parseMessage(message) {
        const headers = message.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const to = headers.find(h => h.name === 'To')?.value || 'Unknown';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        let body = '';
        if (message.payload.body?.data) {
            body = this.decodeBody(message.payload.body.data);
        }
        else if (message.payload.parts) {
            const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain' || part.mimeType === 'text/html');
            if (textPart?.body?.data) {
                body = this.decodeBody(textPart.body.data);
            }
        }
        return {
            id: message.id,
            subject,
            from,
            to,
            date,
            snippet: message.snippet,
            body: body || message.snippet,
            labelIds: message.labelIds,
        };
    }
    decodeBody(encodedData) {
        try {
            return Buffer.from(encodedData, 'base64').toString('utf-8');
        }
        catch (error) {
            console.error('Error decoding body:', error);
            return '';
        }
    }
    async markAsRead(messageId) {
        try {
            await this.gmail.users.messages.modify({
                userId: process.env.GMAIL_USER_ID || 'me',
                id: messageId,
                requestBody: {
                    removeLabelIds: ['UNREAD'],
                },
            });
        }
        catch (error) {
            console.error(`Error marking message ${messageId} as read:`, error);
        }
    }
    // メールが最近のものかどうかをチェック（過去1時間以内）
    isRecentEmail(email) {
        const emailDate = new Date(email.date);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return emailDate > oneHourAgo;
    }
    // プロモーションメールか判定したい。適当に選んだ
    isNotPromotional(email) {
        const promotionalKeywords = [
            'セール', '特価', '割引', 'キャンペーン', '無料', 'プレゼント', '進呈',
            '特集', '大特集', 'お得', 'お見積り', 'WEBセミナー', '交流会',
            '出展', '展示会', 'イベント', 'ニュースレター', '通信',
            '【', '】', '〈', '〉', '『', '』'
        ];
        const subject = email.subject.toLowerCase();
        const from = email.from.toLowerCase();
        // プロモーションキーワードが含まれている場合は除外
        for (const keyword of promotionalKeywords) {
            if (subject.includes(keyword.toLowerCase())) {
                return false;
            }
        }
        // 特定の送信者パターンを除外
        const promotionalDomains = [
            'mitsumi', 'misumi', 'ipros', 'nidec', 'rohde', 'jooto'
        ];
        for (const domain of promotionalDomains) {
            if (from.includes(domain)) {
                return false;
            }
        }
        return true;
    }
}
exports.GmailService = GmailService;
//# sourceMappingURL=gmailService.js.map