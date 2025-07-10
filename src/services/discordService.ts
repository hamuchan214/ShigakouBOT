import { Client, TextChannel, EmbedBuilder } from 'discord.js';
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
    try {
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      if (!channel) {
        throw new Error(`Channel ${this.channelId} not found`);
      }

      const embed = this.createEmailEmbed(email);
      await channel.send({ embeds: [embed] });
      
      console.log(`Email notification sent for: ${email.subject}`);
    } catch (error) {
      console.error('Error sending Discord notification:', error);
    }
  }

  private createEmailEmbed(email: EmailData): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`📧 ${email.subject}`)
      .setDescription(email.snippet.length > 200 ? email.snippet.substring(0, 200) + '...' : email.snippet)
      .setColor(0x0099ff)
      .addFields(
        { name: 'From', value: email.from, inline: true },
        { name: 'To', value: email.to, inline: true },
        { name: 'Date', value: email.date, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Gmail to Discord Bot' });

    return embed;
  }

  async disconnect(): Promise<void> {
    await this.client.destroy();
  }
} 