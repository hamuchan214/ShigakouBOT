import { BotFeature } from '../types/botFeatures';
import { DiscordService } from './discordService';
import { EmbedBuilder, ChatInputCommandInteraction, Interaction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';

interface P2PQuakeEarthquake {
  id: string;
  code: number;
  time: string;
  issue: {
    source: string;
    time: string;
    type: string;
    correct: string;
  };
  earthquake: {
    time: string;
    hypocenter: {
      name: string;
      latitude: number;
      longitude: number;
      depth: number;
      magnitude: number;
    };
    maxScale: number;
    domesticTsunami: string;
    foreignTsunami: string;
  };
}

const SCALE_LABELS: Record<number, string> = {
  10: '震度1',
  20: '震度2',
  30: '震度3',
  40: '震度4',
  45: '震度5弱',
  50: '震度5強',
  55: '震度6弱',
  60: '震度6強',
  70: '震度7',
};

const SCALE_COLORS: Record<number, number> = {
  30: 0xffff00,
  40: 0xff8c00,
  45: 0xff4500,
  50: 0xff0000,
  55: 0x8b0000,
  60: 0x8b0000,
  70: 0x8b0000,
};

function getScaleLabel(scale: number): string {
  return SCALE_LABELS[scale] ?? `震度不明(${scale})`;
}

function getScaleColor(scale: number): number {
  for (const t of [70, 60, 55, 50, 45, 40, 30]) {
    if (scale >= t) return SCALE_COLORS[t];
  }
  return 0xffff00;
}

function getTsunamiLabel(tsunami: string): string {
  const labels: Record<string, string> = {
    None: 'なし',
    Unknown: '不明',
    Checking: '調査中',
    NonEffective: '若干の海面変動',
    Watch: '津波注意報',
    Warning: '津波警報',
  };
  return labels[tsunami] ?? tsunami;
}

function buildMapUrl(lat: number, lon: number): string | null {
  if (lat === -200 || lon === -200) return null;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=5&size=600x400&markers=${lat},${lon},red`;
}

function parseTime(timeStr: string): Date {
  return new Date(timeStr.replace(/\//g, '-').replace(' ', 'T'));
}

interface EarthquakeConfig {
  channelId: string | null;
}

export class EarthquakeNotification implements BotFeature {
  public name = 'earthquakeNotification';
  private discordService: DiscordService;
  private seenIds = new Set<string>();
  private pollInterval: NodeJS.Timeout | null = null;
  private notifyChannelId: string | null = null;
  private configPath: string;

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
    this.configPath = path.join(process.cwd(), 'data', 'earthquake.json');
    this.notifyChannelId = this.loadConfig().channelId ?? process.env.DISCORD_EARTHQUAKE_CHANNEL_ID ?? null;

    const registerCommand = new SlashCommandBuilder()
      .setName('earthquake-register')
      .setDescription('このチャンネルを地震通知チャンネルとして登録します');
    discordService.addExternalCommand(registerCommand, (i: Interaction) =>
      this.handleRegister(i as ChatInputCommandInteraction)
    );

    const testCommand = new SlashCommandBuilder()
      .setName('earthquake-test')
      .setDescription('最新の地震情報を手動取得して表示します');
    discordService.addExternalCommand(testCommand, (i: Interaction) =>
      this.handleTest(i as ChatInputCommandInteraction)
    );
  }

  public async initialize(): Promise<void> {
    await this.seedSeenIds();
    this.pollInterval = setInterval(() => this.poll(), 60_000);
    console.log('[EarthquakeNotification] Polling started (every 60s)');
  }

  private loadConfig(): EarthquakeConfig {
    if (!fs.existsSync(this.configPath)) return { channelId: null };
    return JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) as EarthquakeConfig;
  }

  private saveConfig(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify({ channelId: this.notifyChannelId }, null, 2), 'utf-8');
  }

  private async handleRegister(interaction: ChatInputCommandInteraction): Promise<void> {
    this.notifyChannelId = interaction.channelId;
    this.saveConfig();
    await interaction.reply({
      content: `✅ <#${interaction.channelId}> を地震通知チャンネルに設定しました。`,
      ephemeral: true,
    });
    console.log(`[EarthquakeNotification] Notify channel set to ${interaction.channelId}`);
  }

  private async handleTest(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const earthquakes = await this.fetchEarthquakes();
      const latest = earthquakes.find(eq => (eq.earthquake?.maxScale ?? -1) >= 0);

      if (!latest) {
        await interaction.editReply('直近の地震情報が見つかりませんでした。');
        return;
      }

      const embed = this.buildEmbed(latest);
      await interaction.editReply({ content: '最新の地震情報です。', embeds: [embed] });
    } catch (error) {
      await interaction.editReply('地震情報の取得に失敗しました。');
    }
  }

  private async seedSeenIds(): Promise<void> {
    try {
      const data = await this.fetchEarthquakes();
      for (const eq of data) this.seenIds.add(eq.id);
    } catch (error) {
      console.error('[EarthquakeNotification] Failed to seed seen IDs:', error);
    }
  }

  private async fetchEarthquakes(): Promise<P2PQuakeEarthquake[]> {
    const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=10');
    if (!res.ok) throw new Error(`P2PQuake API error: ${res.status}`);
    return res.json() as Promise<P2PQuakeEarthquake[]>;
  }

  private async poll(): Promise<void> {
    try {
      const earthquakes = await this.fetchEarthquakes();

      for (const eq of earthquakes.reverse()) {
        if (this.seenIds.has(eq.id)) continue;
        this.seenIds.add(eq.id);

        const maxScale = eq.earthquake?.maxScale ?? -1;
        if (maxScale < 30) continue;

        await this.sendNotification(eq);
      }

      if (this.seenIds.size > 500) {
        const arr = [...this.seenIds];
        this.seenIds.clear();
        arr.slice(-200).forEach(id => this.seenIds.add(id));
      }
    } catch (error) {
      console.error('[EarthquakeNotification] Poll error:', error);
    }
  }

  private buildEmbed(eq: P2PQuakeEarthquake): EmbedBuilder {
    const { earthquake, issue } = eq;
    const { hypocenter, maxScale, domesticTsunami } = earthquake;

    const embed = new EmbedBuilder()
      .setTitle(`🚨 地震情報 最大${getScaleLabel(maxScale)}`)
      .setColor(getScaleColor(maxScale))
      .setTimestamp(parseTime(earthquake.time))
      .addFields(
        { name: '震源地', value: hypocenter.name || '不明', inline: true },
        { name: 'マグニチュード', value: hypocenter.magnitude >= 0 ? `M${hypocenter.magnitude}` : '不明', inline: true },
        { name: '深さ', value: hypocenter.depth >= 0 ? `${hypocenter.depth}km` : '不明', inline: true },
        { name: '最大震度', value: getScaleLabel(maxScale), inline: true },
        { name: '津波', value: getTsunamiLabel(domesticTsunami), inline: true },
        { name: '情報源', value: issue.source, inline: true },
      );

    const mapUrl = buildMapUrl(hypocenter.latitude, hypocenter.longitude);
    if (mapUrl) embed.setImage(mapUrl);

    return embed;
  }

  private async sendNotification(eq: P2PQuakeEarthquake): Promise<void> {
    if (!this.notifyChannelId) {
      console.warn('[EarthquakeNotification] No channel set. Use /earthquake-register to configure.');
      return;
    }

    const embed = this.buildEmbed(eq);

    try {
      await this.discordService.sendEmbed(this.notifyChannelId, embed);
      console.log(`[EarthquakeNotification] Sent: ${eq.earthquake.hypocenter.name} ${getScaleLabel(eq.earthquake.maxScale)}`);
    } catch (error) {
      console.error('[EarthquakeNotification] Failed to send:', error);
    }
  }

  public async execute(): Promise<void> {}

  public async shutdown(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
