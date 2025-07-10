"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordService = void 0;
const discord_js_1 = require("discord.js");
class DiscordService {
    constructor() {
        this.client = new discord_js_1.Client({
            intents: ['Guilds', 'GuildMessages', 'MessageContent'],
        });
        this.channelId = process.env.DISCORD_CHANNEL_ID || '';
    }
    async initialize() {
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
    async sendEmailNotification(email) {
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            if (!channel) {
                throw new Error(`Channel ${this.channelId} not found`);
            }
            const embed = this.createEmailEmbed(email);
            await channel.send({ embeds: [embed] });
            console.log(`Email notification sent for: ${email.subject}`);
        }
        catch (error) {
            console.error('Error sending Discord notification:', error);
        }
    }
    createEmailEmbed(email) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`📧 ${email.subject}`)
            .setDescription(email.snippet.length > 200 ? email.snippet.substring(0, 200) + '...' : email.snippet)
            .setColor(0x0099ff)
            .addFields({ name: 'From', value: email.from, inline: true }, { name: 'To', value: email.to, inline: true }, { name: 'Date', value: email.date, inline: true })
            .setTimestamp()
            .setFooter({ text: 'Gmail to Discord Bot' });
        return embed;
    }
    async disconnect() {
        await this.client.destroy();
    }
}
exports.DiscordService = DiscordService;
//# sourceMappingURL=discordService.js.map