import { google } from 'googleapis';
import { GmailMessage, EmailData } from '../types';

export class GmailService {
  private gmail: any;
  private lastCheckedMessageId: string | null = null;
  private lastCheckTime: Date | null = null;

  constructor() {
    this.initializeGmail();
  }

  private initializeGmail(): void {
    const auth = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );

    auth.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async getUnreadMessages(): Promise<EmailData[]> {
    try {
      // より確実な方法：最近のメールを取得して時刻でフィルタリング
      const query = '-category:promotions -category:social -category:updates -category:forums';
      console.log(`Using query: ${query}`);
      
      if (this.lastCheckTime) {
        console.log(`Last check time: ${this.lastCheckTime}`);
      } else {
        console.log(`First run`);
      }

      const response = await this.gmail.users.messages.list({
        userId: process.env.GMAIL_USER_ID || 'me',
        q: query,
        maxResults: 10, // より多くのメールを取得
      });

      console.log(`Gmail API response: ${response.data.messages?.length || 0} messages found`);

      const messages = response.data.messages || [];
      const emailData: EmailData[] = [];

      for (const message of messages) {
        const email = await this.getMessageDetails(message.id);
        if (email && this.isNotPromotional(email)) {
          // 初回実行時は過去1時間のメールのみを対象にする
          const emailDate = this.parseEmailDate(email.date);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          
          if (!this.lastCheckTime) {
            // 初回実行時：過去1時間のメールのみ
            if (emailDate > oneHourAgo) {
              emailData.push(email);
              console.log(`First run - Found recent email: ${email.subject} (${email.date})`);
            } else {
              console.log(`First run - Skipping old email: ${email.subject} (${email.date})`);
            }
          } else {
            // 2回目以降：前回チェック時刻以降のメール
            const emailTimestamp = emailDate.getTime();
            const lastCheckTimestamp = this.lastCheckTime.getTime();
            
            console.log(`Comparing timestamps: email=${emailTimestamp}, lastCheck=${lastCheckTimestamp}, diff=${emailTimestamp - lastCheckTimestamp}ms`);
            
            if (emailTimestamp > lastCheckTimestamp) {
              emailData.push(email);
              console.log(`Found new email: ${email.subject} (${email.date})`);
            } else {
              console.log(`Skipping old email: ${email.subject} (${email.date})`);
            }
          }
        }
      }

      // チェック時刻を更新
      this.lastCheckTime = new Date();
      console.log(`Updated last check time to: ${this.lastCheckTime}`);

      return emailData;
    } catch (error) {
      console.error('Gmail API error:', error);
      return [];
    }
  }

  private async getMessageDetails(messageId: string): Promise<EmailData | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: process.env.GMAIL_USER_ID || 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data as GmailMessage;
      return this.parseMessage(message);
    } catch (error) {
      console.error(`Error getting message details for ${messageId}:`, error);
      return null;
    }
  }

  private parseMessage(message: GmailMessage): EmailData {
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const to = headers.find(h => h.name === 'To')?.value || 'Unknown';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    let body = '';
    if (message.payload.body?.data) {
      body = this.decodeBody(message.payload.body.data);
    } else if (message.payload.parts) {
      const textPart = message.payload.parts.find(part => 
        part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
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

  private decodeBody(encodedData: string): string {
    try {
      return Buffer.from(encodedData, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Error decoding body:', error);
      return '';
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: process.env.GMAIL_USER_ID || 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    } catch (error) {
      console.error(`Error marking message ${messageId} as read:`, error);
    }
  }

  // メールが最近のものかどうかをチェック（過去1時間以内）
  private isRecentEmail(email: EmailData): boolean {
    const emailDate = new Date(email.date);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return emailDate > oneHourAgo;
  }

  // Gmailの日付文字列を確実にパースする
  private parseEmailDate(dateString: string): Date {
    try {
      // RFC 2822形式の日付をパース
      const date = new Date(dateString);
      
      // パースが失敗した場合のフォールバック
      if (isNaN(date.getTime())) {
        console.warn(`Failed to parse date: ${dateString}, using current time`);
        return new Date();
      }
      
      return date;
    } catch (error) {
      console.error(`Error parsing date: ${dateString}`, error);
      return new Date();
    }
  }

  // プロモーションメールか判定したい。適当に選んだ
  private isNotPromotional(email: EmailData): boolean {
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