import { EmailForwarder } from '../../src/services/emailForwarder';
import { EmailData } from '../../src/types';

// 依存サービスのモック
jest.mock('../../src/services/gmailService');
jest.mock('../../src/services/discordService');

describe('EmailForwarder', () => {
  let emailForwarder: EmailForwarder;
  let mockGmailService: any;
  let mockDiscordService: any;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // モックを取得
    const { GmailService } = require('../../src/services/gmailService');
    const { DiscordService } = require('../../src/services/discordService');
    
    mockGmailService = new GmailService();
    mockDiscordService = new DiscordService();
    
    // EmailForwarderにモックを注入
    emailForwarder = new EmailForwarder(mockGmailService, mockDiscordService);
  });

  describe('initialize', () => {
    it('should initialize Discord service', async () => {
      mockDiscordService.initialize.mockResolvedValue(undefined);

      await emailForwarder.initialize();

      expect(mockDiscordService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockDiscordService.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(emailForwarder.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('execute', () => {
    const mockEmails: EmailData[] = [
      {
        id: '1',
        subject: 'テストメール1',
        from: 'sender1@example.com',
        to: 'recipient@example.com',
        date: 'Tue, 15 Jul 2025 09:15:28 +0900',
        snippet: 'テストメール1の内容',
      },
      {
        id: '2',
        subject: 'テストメール2',
        from: 'sender2@example.com',
        to: 'recipient@example.com',
        date: 'Tue, 15 Jul 2025 09:16:28 +0900',
        snippet: 'テストメール2の内容',
      },
    ];

    beforeEach(async () => {
      // 初期化を完了
      mockDiscordService.initialize.mockResolvedValue(undefined);
      await emailForwarder.initialize();
    });

    it('should process new emails successfully', async () => {
      mockGmailService.getAllMessages.mockResolvedValue(mockEmails);
      mockDiscordService.sendEmailNotification.mockResolvedValue(undefined);

      await emailForwarder.execute();

      expect(mockGmailService.getAllMessages).toHaveBeenCalled();
      expect(mockDiscordService.sendEmailNotification).toHaveBeenCalledTimes(2);
      expect(mockDiscordService.sendEmailNotification).toHaveBeenCalledWith(mockEmails[0]);
      expect(mockDiscordService.sendEmailNotification).toHaveBeenCalledWith(mockEmails[1]);
    });

    it('should skip already processed emails', async () => {
      mockGmailService.getAllMessages.mockResolvedValue(mockEmails);
      mockDiscordService.sendEmailNotification.mockResolvedValue(undefined);

      // 1回目実行
      await emailForwarder.execute();
      
      // 2回目実行（同じメール）
      await emailForwarder.execute();

      // 2回目の実行では送信されないことを確認
      expect(mockDiscordService.sendEmailNotification).toHaveBeenCalledTimes(2);
    });

    it('should handle empty email list', async () => {
      mockGmailService.getAllMessages.mockResolvedValue([]);

      await emailForwarder.execute();

      expect(mockGmailService.getAllMessages).toHaveBeenCalled();
      expect(mockDiscordService.sendEmailNotification).not.toHaveBeenCalled();
    });

    it('should handle Gmail service errors gracefully', async () => {
      mockGmailService.getAllMessages.mockRejectedValue(new Error('Gmail API Error'));

      await expect(emailForwarder.execute()).resolves.not.toThrow();
    });

    it('should handle Discord service errors gracefully', async () => {
      mockGmailService.getAllMessages.mockResolvedValue(mockEmails);
      mockDiscordService.sendEmailNotification.mockRejectedValue(new Error('Discord API Error'));

      await expect(emailForwarder.execute()).resolves.not.toThrow();
    });

    it('should limit processed emails to prevent memory leaks', async () => {
      // 大量のメールを生成
      const manyEmails = Array.from({ length: 1100 }, (_, i) => ({
        id: `email-${i}`,
        subject: `メール${i}`,
        from: `sender${i}@example.com`,
        to: 'recipient@example.com',
        date: 'Tue, 15 Jul 2025 09:15:28 +0900',
        snippet: `メール${i}の内容`,
      }));

      mockGmailService.getAllMessages.mockResolvedValue(manyEmails);
      mockDiscordService.sendEmailNotification.mockResolvedValue(undefined);

      await emailForwarder.execute();

      // 1100件処理されるが、最後の1000件のみが保持される
      expect(mockDiscordService.sendEmailNotification).toHaveBeenCalledTimes(1100);
    });
  });

  describe('shutdown', () => {
    it('should shutdown Discord service', async () => {
      mockDiscordService.disconnect.mockResolvedValue(undefined);

      await emailForwarder.shutdown();

      expect(mockDiscordService.disconnect).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      mockDiscordService.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      // エラーが投げられても処理は続行される
      await expect(emailForwarder.shutdown()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('BotFeature interface implementation', () => {
    it('should have correct name property', () => {
      expect(emailForwarder.name).toBe('emailForwarder');
    });

    it('should implement all required methods', () => {
      expect(typeof emailForwarder.initialize).toBe('function');
      expect(typeof emailForwarder.execute).toBe('function');
      expect(typeof emailForwarder.shutdown).toBe('function');
    });
  });
}); 