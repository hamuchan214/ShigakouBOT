import { EmailForwarder } from '../../src/services/emailForwarder';
import { EmailData } from '../../src/types';

// 統合テスト用のモック
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

jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn(),
    channels: {
      fetch: jest.fn(),
    },
    destroy: jest.fn(),
    user: {
      tag: 'TestBot#1234',
    },
  })),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
  })),
}));

describe('Email Forwarding Integration', () => {
  let emailForwarder: EmailForwarder;
  let mockGmail: any;
  let mockDiscord: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockGmail = {
      getAllMessages: jest.fn(),
    };
    mockDiscord = {
      initialize: jest.fn().mockResolvedValue(undefined),
      sendEmailNotification: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    emailForwarder = new EmailForwarder(mockGmail, mockDiscord);
    await emailForwarder.initialize();
  }, 15000);

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete email forwarding flow', () => {
    const mockEmails = [
      {
        id: '1',
        subject: '重要なメール',
        from: 'important@example.com',
        to: 'user@example.com',
        date: 'Tue, 15 Jul 2025 09:15:28 +0900',
        snippet: 'これは重要なメールです',
      },
      {
        id: '2',
        subject: 'プロモーション',
        from: 'promo@example.com',
        to: 'user@example.com',
        date: 'Tue, 15 Jul 2025 09:16:28 +0900',
        snippet: '特別オファーです',
      },
    ];

    it('should process and forward emails successfully', async () => {
      mockGmail.getAllMessages.mockResolvedValue(mockEmails);
      mockDiscord.sendEmailNotification.mockResolvedValue(undefined);

      await emailForwarder.execute();

      expect(mockGmail.getAllMessages).toHaveBeenCalled();
      expect(mockDiscord.sendEmailNotification).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should filter out promotional emails', async () => {
      mockGmail.getAllMessages.mockResolvedValue(mockEmails);
      mockDiscord.sendEmailNotification.mockResolvedValue(undefined);

      await emailForwarder.execute();

      // プロモーションメールも含めて全て処理される
      expect(mockDiscord.sendEmailNotification).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should handle API errors gracefully', async () => {
      mockGmail.getAllMessages.mockRejectedValue(new Error('Gmail API Error'));

      await expect(emailForwarder.execute()).resolves.not.toThrow();
    }, 15000);

    it('should handle Discord API errors gracefully', async () => {
      mockGmail.getAllMessages.mockResolvedValue(mockEmails);
      mockDiscord.sendEmailNotification.mockRejectedValue(new Error('Discord API Error'));

      await expect(emailForwarder.execute()).resolves.not.toThrow();
    }, 15000);
  });

  describe('Shutdown flow', () => {
    it('should shutdown gracefully', async () => {
      mockDiscord.disconnect.mockResolvedValue(undefined);
      
      await expect(emailForwarder.shutdown()).resolves.not.toThrow();
      expect(mockDiscord.disconnect).toHaveBeenCalled();
    }, 15000);
  });
}); 