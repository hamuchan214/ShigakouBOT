import { Client, GatewayIntentBits, TextChannel, EmbedBuilder } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { EmailData } from '../types';

export class DiscordService {
  private client: Client;
  private channelId: string;

  constructor() {
    this.client = new Client({
      intents: ['Guilds', 'GuildMessages', 'MessageContent'],
    });
    this.channelId = process.env.DISCORD_CHANNEL_ID || '';
  }

  private setupSlashCommands(): void {
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'testmention') {
        try {
          const channelId = interaction.channelId;
          if (channelId) {
            await this.sendMessage(channelId, '@everyone メンションテストです');
            await interaction.reply({ content: 'メンションを送信しました！', ephemeral: true });
          } else {
            await interaction.reply({ content: 'このチャンネルではメンションを送信できません。', ephemeral: true });
          }
        } catch (error) {
          console.error('[testmention] Error:', error);
          await interaction.reply({ content: 'メンションの送信に失敗しました。', ephemeral: true }).catch(() => {});
        }
      }
    });
  }

  private async registerSlashCommands(): Promise<void> {
    const token = process.env.DISCORD_TOKEN;
    const clientId = this.client.user?.id;
    if (!token || !clientId) return;

    const commands = [
      new SlashCommandBuilder()
        .setName('testmention')
        .setDescription('メンション（@everyone）のテストを送信します')
        .toJSON(),
    ];

    const rest = new REST({ version: '10' }).setToken(token);
    const guildId = process.env.DISCORD_GUILD_ID;

    try {
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log(`Slash commands registered for guild ${guildId}`);
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('Slash commands registered globally (may take up to 1 hour to propagate)');
      }
    } catch (error) {
      console.error('Failed to register slash commands:', error);
    }
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('ready', async () => {
        console.log(`Discord bot logged in as ${this.client.user?.tag}`);

        this.setupSlashCommands();
        await this.registerSlashCommands();

        resolve();
      });

      this.client.on('error', (error) => {
        console.error('Discord client error:', error);
        reject(error);
      });

      this.client.login(process.env.DISCORD_TOKEN);
    });
  }

  async sendEmailNotification(email: EmailData, title?: string): Promise<void> {
    const channel = (await this.client.channels.fetch(
      this.channelId,
    )) as TextChannel;
    if (!channel) {
      throw new Error(`Channel ${this.channelId} not found`);
    }

    const embed = this.createEmailEmbed(email, title);
    await this.sendEmbed(this.channelId, embed);

    console.log(`Email notification sent for: ${email.subject}`);
  }

  async sendEmbed(channelId: string, embed: EmbedBuilder): Promise<void> {
    if (!channelId) {
      throw new Error('Channel ID was not provided to sendEmbed.');
    }
    const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    await channel.send({ embeds: [embed] });
  }

  /**
   * プレーンテキスト（メンション含む）をチャンネルに送信する
   */
  async sendMessage(channelId: string, content: string): Promise<void> {
    if (!channelId) {
      throw new Error('Channel ID was not provided to sendMessage.');
    }
    const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    await channel.send({ content });
  }

  private createEmailEmbed(email: EmailData, title?: string): EmbedBuilder {
    const description = email.body || email.snippet || '内容なし';
    const finalTitle = title || `📧 新しいメール: ${email.subject}`;
    const embed = new EmbedBuilder()
      .setTitle(finalTitle.substring(0, 256))
      .setDescription(description.substring(0, 4096))
      .setColor(0x0099ff)
      .addFields(
        { name: 'From', value: email.from.substring(0, 1024), inline: true },
        { name: 'To', value: email.to.substring(0, 1024), inline: true },
        { name: 'Date', value: email.date, inline: true },
      )
      .setTimestamp();

    return embed;
  }

  public async sendErrorNotification(
    error: Error,
    context: string,
  ): Promise<void> {
    try {
      const channel = (await this.client.channels.fetch(
        this.channelId,
      )) as TextChannel;
      if (!channel) {
        console.error(
          `Error notification channel ${this.channelId} not found.`,
        );
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🚨 Bot Error: ${context}`)
        .setDescription(
          `An error occurred. See details below.\n\n**Error:**\n\`\`\`${error.message.substring(
            0,
            1500,
          )}\`\`\``,
        )
        .setColor(0xff0000) // Red
        .addFields({
          name: 'Stack Trace',
          value: `\`\`\`${error.stack || 'No stack trace available'}\`\`\``.substring(0, 1024),
        })
        .setTimestamp();

      await this.sendEmbed(this.channelId, embed);
    } catch (sendError: any) {
      console.error('Failed to send error notification to Discord:', sendError);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.destroy();
  }
} 