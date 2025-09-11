import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';
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

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('ready', () => {
        console.log(`Discord bot logged in as ${this.client.user?.tag}`);
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

  private createEmailEmbed(email: EmailData, title?: string): EmbedBuilder {
    const description = email.body || email.snippet;
    const embed = new EmbedBuilder()
      .setTitle(title || `📧 新しいメール: ${email.subject}`)
      .setDescription(description.substring(0, 4096))
      .setColor(0x0099ff)
      .addFields(
        { name: 'From', value: email.from, inline: true },
        { name: 'To', value: email.to, inline: true },
        { name: 'Date', value: email.date, inline: true }
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
          `An error occurred. See details below.\n\n**Error:**\n\`\`\`${error.message}\`\`\``,
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