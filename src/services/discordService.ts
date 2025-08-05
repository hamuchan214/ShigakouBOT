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

  async sendEmailNotification(email: EmailData): Promise<void> {
    const channel = (await this.client.channels.fetch(
      this.channelId,
    )) as TextChannel;
    if (!channel) {
      throw new Error(`Channel ${this.channelId} not found`);
    }

    const embed = this.createEmailEmbed(email);
    await channel.send({ embeds: [embed] });

    console.log(`Email notification sent for: ${email.subject}`);
  }

  private createEmailEmbed(email: EmailData): EmbedBuilder {
    const description = email.body || email.snippet;
    const embed = new EmbedBuilder()
      .setTitle(`📧 新しいメール: ${email.subject}`)
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

  async disconnect(): Promise<void> {
    await this.client.destroy();
  }
} 