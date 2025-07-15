import { GmailService } from '../../src/services/gmailService';
import { EmailData } from '../../src/types';

// GmailServiceのモック
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    gmail: jest.fn().mockReturnValue({
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
          modify: jest.fn(),
        },
      },
    }),
  },
}));

describe('GmailService', () => {
  let gmailService: GmailService;
  let mockGmail: any;

  beforeEach(() => {
    // 環境変数を設定
    process.env.GMAIL_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';
    process.env.GMAIL_USER_ID = 'me';

    gmailService = new GmailService();
    
    // モックを取得
    const { google } = require('googleapis');
    mockGmail = google.gmail();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseEmailDate', () => {
    it('should parse valid RFC 2822 date strings', () => {
      const validDate = 'Tue, 15 Jul 2025 09:15:28 +0900';
      const result = (gmailService as any).parseEmailDate(validDate);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(0);
    });

    it('should handle invalid date strings', () => {
      const invalidDate = 'invalid-date-string';
      const result = (gmailService as any).parseEmailDate(invalidDate);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(0);
    });

    it('should handle empty date strings', () => {
      const emptyDate = '';
      const result = (gmailService as any).parseEmailDate(emptyDate);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(0);
    });
  });

  describe('isNotPromotional', () => {
    it('should filter out promotional emails by keywords', () => {
      const promotionalEmail: EmailData = {
        id: '1',
        subject: '【セール】特別価格でお得に購入！',
        from: 'sales@example.com',
        to: 'user@example.com',
        date: 'Tue, 15 Jul 2025 09:15:28 +0900',
        snippet: '特別価格でお得に購入できます',
      };

      const result = (gmailService as any).isNotPromotional(promotionalEmail);
      expect(result).toBe(false);
    });

    it('should filter out promotional emails by domain', () => {
      const promotionalEmail: EmailData = {
        id: '2',
        subject: 'ニュースレター',
        from: 'newsletter@misumi.com',
        to: 'user@example.com',
        date: 'Tue, 15 Jul 2025 09:15:28 +0900',
        snippet: '最新のニュースをお届けします',
      };

      const result = (gmailService as any).isNotPromotional(promotionalEmail);
      expect(result).toBe(false);
    });

    it('should allow non-promotional emails', () => {
      const normalEmail: EmailData = {
        id: '3',
        subject: '会議の件について',
        from: 'colleague@company.com',
        to: 'user@example.com',
        date: 'Tue, 15 Jul 2025 09:15:28 +0900',
        snippet: '明日の会議について相談したいです',
      };

      const result = (gmailService as any).isNotPromotional(normalEmail);
      expect(result).toBe(true);
    });
  });

  describe('getUnreadMessages', () => {
    it('should return empty array when no messages found', async () => {
      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: [] },
      });

      const result = await gmailService.getUnreadMessages();
      expect(result).toEqual([]);
    });

    it('should filter out promotional emails', async () => {
      const mockMessages = [
        { id: '1' },
        { id: '2' },
      ];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: mockMessages },
      });

      // プロモーションメールと通常メールをモック
      mockGmail.users.messages.get
        .mockResolvedValueOnce({
          data: {
            id: '1',
            snippet: 'セール情報',
            payload: {
              headers: [
                { name: 'Subject', value: '【セール】特別価格' },
                { name: 'From', value: 'sales@example.com' },
                { name: 'To', value: 'user@example.com' },
                { name: 'Date', value: 'Tue, 15 Jul 2025 09:15:28 +0900' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: '2',
            snippet: '会議の件',
            payload: {
              headers: [
                { name: 'Subject', value: '会議の件について' },
                { name: 'From', value: 'colleague@company.com' },
                { name: 'To', value: 'user@example.com' },
                { name: 'Date', value: 'Tue, 15 Jul 2025 09:15:28 +0900' },
              ],
            },
          },
        });

      const result = await gmailService.getUnreadMessages();
      
      // プロモーションメールが除外されていることを確認
      expect(result.length).toBe(1);
      expect(result[0].subject).toBe('会議の件について');
    });

    it('should handle API errors gracefully', async () => {
      mockGmail.users.messages.list.mockRejectedValue(new Error('API Error'));

      const result = await gmailService.getUnreadMessages();
      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('should call Gmail API to mark message as read', async () => {
      mockGmail.users.messages.modify.mockResolvedValue({});

      await gmailService.markAsRead('test-message-id');

      expect(mockGmail.users.messages.modify).toHaveBeenCalledWith({
        userId: 'me',
        id: 'test-message-id',
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    });

    it('should handle API errors gracefully', async () => {
      mockGmail.users.messages.modify.mockRejectedValue(new Error('API Error'));

      // エラーが発生しても例外を投げないことを確認
      await expect(gmailService.markAsRead('test-message-id')).resolves.not.toThrow();
    });
  });
}); 