import { DiscordService } from '../../src/services/discordService';
import { EmailData } from '../../src/types';
import * as Discord from 'discord.js';

// Discord.jsのモック
jest.mock('discord.js', () => ({
  Client: jest.fn(),
  EmbedBuilder: jest.fn(),
}));

describe('DiscordService', () => {
  let discordService: DiscordService;
  let mockClient: any;
  let mockChannel: any;
  let mockEmbed: any;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // 環境変数を設定
    process.env.DISCORD_TOKEN = 'test-token';
    process.env.DISCORD_CHANNEL_ID = 'test-channel-id';
    
    // Discord.jsのモック
    mockClient = {
      login: jest.fn(),
      once: jest.fn(),
      on: jest.fn(),
      destroy: jest.fn(),
      channels: {
        fetch: jest.fn(),
      },
    };

    mockChannel = {
      send: jest.fn(),
    };

    mockEmbed = {
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockReturnThis(),
      setTimestamp: jest.fn().mockReturnThis(),
    };

    // Discord.jsのコンストラクタをモック
    (Discord.Client as unknown as jest.Mock).mockImplementation(() => mockClient);
    (Discord.EmbedBuilder as unknown as jest.Mock).mockImplementation(() => mockEmbed);

    discordService = new DiscordService();
  });

  describe('initialize', () => {
    it('should initialize Discord client successfully', async () => {
      mockClient.once.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          callback();
        }
      });

      const initPromise = discordService.initialize();
      
      // 即座にreadyイベントを発火
      setTimeout(() => {
        const readyCallback = mockClient.once.mock.calls.find(
          (call: any) => call[0] === 'ready'
        )?.[1];
        if (readyCallback) {
          readyCallback();
        }
      }, 0);

      await initPromise;

      expect(mockClient.login).toHaveBeenCalledWith('test-token');
    }, 15000);

    it('should handle initialization errors', async () => {
      mockClient.once.mockImplementation((event: string, callback: any) => {
        // readyイベントは呼ばない
      });
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          // errorイベントを即時発火
          callback(new Error('Connection failed'));
        }
      });

      const initPromise = discordService.initialize();
      // errorイベントのみ発火
      await expect(initPromise).rejects.toThrow('Connection failed');
    }, 15000);
  });

  describe('sendEmailNotification', () => {
    const mockEmail: EmailData = {
      id: '1',
      subject: 'テストメール',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      date: 'Tue, 15 Jul 2025 09:15:28 +0900',
      snippet: 'これはテストメールです',
    };

    beforeEach(async () => {
      // 初期化を完了
      mockClient.once.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          callback();
        }
      });

      const initPromise = discordService.initialize();
      
      // 即座にreadyイベントを発火
      setTimeout(() => {
        const readyCallback = mockClient.once.mock.calls.find(
          (call: any) => call[0] === 'ready'
        )?.[1];
        if (readyCallback) {
          readyCallback();
        }
      }, 0);

      await initPromise;
    }, 15000);

    it('should send email notification successfully', async () => {
      mockClient.channels.fetch.mockResolvedValue(mockChannel);
      mockChannel.send.mockResolvedValue(undefined);

      await discordService.sendEmailNotification(mockEmail);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('test-channel-id');
      expect(mockChannel.send).toHaveBeenCalled();
    }, 15000);

    it('should handle channel not found error', async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(discordService.sendEmailNotification(mockEmail)).rejects.toThrow(
        'Channel test-channel-id not found'
      );
    }, 15000);

    it('should handle send error gracefully', async () => {
      mockClient.channels.fetch.mockResolvedValue(mockChannel);
      mockChannel.send.mockRejectedValue(new Error('Send failed'));

      await expect(discordService.sendEmailNotification(mockEmail)).rejects.toThrow('Send failed');
    }, 15000);
  });

  describe('createEmailEmbed', () => {
    it('should create embed with correct properties', () => {
      const email: EmailData = {
        id: '1',
        subject: 'テストメール',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: 'Tue, 15 Jul 2025 09:15:28 +0900',
        snippet: 'これはテストメールです',
      };

      const embed = (discordService as any).createEmailEmbed(email);

      expect(embed.setTitle).toHaveBeenCalledWith('📧 新しいメール: テストメール');
      expect(embed.setDescription).toHaveBeenCalledWith('これはテストメールです');
      expect(embed.setColor).toHaveBeenCalledWith(0x0099ff);
      expect(embed.addFields).toHaveBeenCalledWith(
        { name: 'From', value: 'sender@example.com', inline: true },
        { name: 'To', value: 'recipient@example.com', inline: true },
        { name: 'Date', value: 'Tue, 15 Jul 2025 09:15:28 +0900', inline: true }
      );
    });
  });

  describe('disconnect', () => {
    it('should destroy Discord client', async () => {
      await discordService.disconnect();
      expect(mockClient.destroy).toHaveBeenCalled();
    });
  });
}); 