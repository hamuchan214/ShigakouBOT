import { GmailService } from '../../src/services/gmailService';
import { EmailData } from '../../src/types';
import { google } from 'googleapis';

// googleapisのモック
jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(),
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
  },
}));

describe('GmailService', () => {
  let gmailService: GmailService;
  let mockGmail: any;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // Gmail APIのモック
    mockGmail = {
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
          modify: jest.fn(),
        },
      },
    };

    // google.gmailのモック
    (google.gmail as jest.Mock).mockReturnValue(mockGmail);

    gmailService = new GmailService();
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
    it('should get unread messages successfully', async () => {
      const mockMessages = [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' },
      ];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: mockMessages },
      });

      mockGmail.users.messages.get
        .mockResolvedValueOnce({
          data: {
            id: 'msg1',
            snippet: 'テストメール1の内容',
            payload: {
              headers: [
                { name: 'Subject', value: 'テストメール1' },
                { name: 'From', value: 'sender1@example.com' },
                { name: 'To', value: 'recipient@example.com' },
                { name: 'Date', value: 'Tue, 15 Jul 2025 09:15:28 +0900' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 'msg2',
            snippet: 'テストメール2の内容',
            payload: {
              headers: [
                { name: 'Subject', value: 'テストメール2' },
                { name: 'From', value: 'sender2@example.com' },
                { name: 'To', value: 'recipient@example.com' },
                { name: 'Date', value: 'Tue, 15 Jul 2025 09:16:28 +0900' },
              ],
            },
          },
        });

      const emails = await gmailService.getAllMessages();

      expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        q: '-category:promotions -category:social -category:updates -category:forums',
        maxResults: 20,
      });
      expect(mockGmail.users.messages.get).toHaveBeenCalledTimes(2);
      expect(emails).toHaveLength(2);
      expect(emails[0].subject).toBe('テストメール1');
      expect(emails[1].subject).toBe('テストメール2');
    });

    it('should filter out promotional emails', async () => {
      const mockMessages = [{ id: 'msg1', threadId: 'thread1' }];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: mockMessages },
      });

      mockGmail.users.messages.get.mockResolvedValue({
        data: {
          id: 'msg1',
          snippet: '【セール】特別価格でお得に購入！',
          payload: {
            headers: [
              { name: 'Subject', value: '【セール】特別価格でお得に購入！' },
              { name: 'From', value: 'sales@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Date', value: 'Tue, 15 Jul 2025 09:15:28 +0900' },
            ],
          },
        },
      });

      const emails = await gmailService.getAllMessages();

      expect(emails).toHaveLength(0);
    });

    it('should handle empty message list', async () => {
      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: [] },
      });

      const emails = await gmailService.getAllMessages();

      expect(emails).toHaveLength(0);
      expect(mockGmail.users.messages.get).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockGmail.users.messages.list.mockRejectedValue(new Error('Gmail API Error'));

      const emails = await gmailService.getAllMessages();

      expect(emails).toHaveLength(0);
    });

    it('should use ID-based filtering for subsequent checks', async () => {
      // 1回目の実行
      const firstMessages = [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' },
      ];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: firstMessages },
      });

      mockGmail.users.messages.get
        .mockResolvedValueOnce({
          data: {
            id: 'msg1',
            snippet: 'テストメール1の内容',
            payload: {
              headers: [
                { name: 'Subject', value: 'テストメール1' },
                { name: 'From', value: 'sender1@example.com' },
                { name: 'To', value: 'recipient@example.com' },
                { name: 'Date', value: 'Tue, 15 Jul 2025 09:15:28 +0900' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 'msg2',
            snippet: 'テストメール2の内容',
            payload: {
              headers: [
                { name: 'Subject', value: 'テストメール2' },
                { name: 'From', value: 'sender2@example.com' },
                { name: 'To', value: 'recipient@example.com' },
                { name: 'Date', value: 'Tue, 15 Jul 2025 09:16:28 +0900' },
              ],
            },
          },
        });

      await gmailService.getAllMessages();

      // 2回目の実行（新しいメールのみ）
      const newMessages = [
        { id: 'msg3', threadId: 'thread3' },
        { id: 'msg1', threadId: 'thread1' }, // 前回チェック済み
      ];

      mockGmail.users.messages.list.mockResolvedValue({
        data: { messages: newMessages },
      });

      mockGmail.users.messages.get
        .mockResolvedValueOnce({
          data: {
            id: 'msg3',
            snippet: '新しいメールの内容',
            payload: {
              headers: [
                { name: 'Subject', value: '新しいメール' },
                { name: 'From', value: 'new@example.com' },
                { name: 'To', value: 'recipient@example.com' },
                { name: 'Date', value: 'Tue, 15 Jul 2025 09:17:28 +0900' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 'msg1',
            snippet: '前回チェック済みメールの内容',
            payload: {
              headers: [
                { name: 'Subject', value: '前回チェック済みメール' },
                { name: 'From', value: 'old@example.com' },
                { name: 'To', value: 'recipient@example.com' },
                { name: 'Date', value: 'Tue, 15 Jul 2025 09:15:28 +0900' },
              ],
            },
          },
        });

      const emails = await gmailService.getAllMessages();

      // 新しいメールのみが処理される
      expect(emails).toHaveLength(1);
      expect(emails[0].id).toBe('msg3');
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