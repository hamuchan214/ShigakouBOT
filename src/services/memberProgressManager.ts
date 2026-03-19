import { schedule, ScheduledTask } from 'node-cron';
import { Interaction, MessageContextMenuCommandInteraction, ApplicationCommandType } from 'discord.js';
import { ContextMenuCommandBuilder } from '@discordjs/builders';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { BotFeature } from '../types/botFeatures';
import { DiscordService } from './discordService';

interface Task {
  startDate: string;  // YYYY-MM-DD
  endDate: string | null;
  description: string;
}

interface MemberData {
  displayName: string;
  tasks: Task[];
  updatedAt: string;
}

interface ProgressData {
  members: Record<string, MemberData>;
}

/**
 * 部員の進捗管理機能
 * - 部員のメッセージを右クリック →「進捗登録」でタスクを登録
 *   (Claude AI が自然文を JSON 構造化し、メッセージ送信者のタスクとして保存)
 * - 毎日 9:00 JST に今日のタスク一覧をチャンネルへ送信
 */
export class MemberProgressManager implements BotFeature {
  public name = 'memberProgressManager';
  private discordService: DiscordService;
  private cronJob: ScheduledTask | null = null;
  private dataPath: string;
  private anthropic: Anthropic;

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
    this.anthropic = new Anthropic();
    this.dataPath = path.join(process.cwd(), 'data', 'progress.json');

    // メッセージコンテキストメニューコマンドを登録
    // (discordService.initialize() より前に呼ぶ必要があるためコンストラクタで実施)
    const command = new ContextMenuCommandBuilder()
      .setName('進捗登録')
      .setType(ApplicationCommandType.Message);

    discordService.addExternalCommand(command, this.handleContextMenu.bind(this));
  }

  private loadData(): ProgressData {
    if (!fs.existsSync(this.dataPath)) {
      return { members: {} };
    }
    return JSON.parse(fs.readFileSync(this.dataPath, 'utf-8')) as ProgressData;
  }

  private saveData(data: ProgressData): void {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async parseTasksWithAI(rawText: string): Promise<Task[]> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `以下のテキストからタスクスケジュールを抽出してください。

今日の日付: ${year}-${month}-${day}
基準年月: ${year}年${month}月

抽出ルール:
- 「19」「19,20」「19〜22」のような数字のみの日付は基準年月で解釈
- 「23〜」のように終了日がない場合は endDate を null にする
- 「1真ん中部分のタイミングベルトを試す」のような番号付きタスクも抽出（直近の日付を適用）
- 現状説明・課題感・背景説明などタスクでない文章は含めない

以下のJSON形式のみで返答してください（説明文・コードブロック不要）:
{"tasks":[{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD or null","description":"タスクの説明"}]}

テキスト:
${rawText}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AIの返答からJSONを抽出できませんでした');

    const parsed = JSON.parse(jsonMatch[0]) as { tasks: Task[] };
    return parsed.tasks ?? [];
  }

  private async handleContextMenu(interaction: Interaction): Promise<void> {
    if (!interaction.isMessageContextMenuCommand()) return;

    const ctx = interaction as MessageContextMenuCommandInteraction;
    await ctx.deferReply({ ephemeral: true });

    const targetMessage = ctx.targetMessage;
    const rawText = targetMessage.content;
    const targetUser = targetMessage.author;
    const displayName =
      targetMessage.member?.displayName ?? targetUser.username;

    if (!rawText.trim()) {
      await ctx.editReply('⚠️ 対象メッセージにテキストがありません。');
      return;
    }

    const tasks = await this.parseTasksWithAI(rawText);

    if (tasks.length === 0) {
      await ctx.editReply(
        '⚠️ タスクを検出できませんでした。日付付きのタスクが含まれているメッセージを選んでください。',
      );
      return;
    }

    const data = this.loadData();
    data.members[targetUser.id] = {
      displayName,
      tasks,
      updatedAt: new Date().toISOString(),
    };
    this.saveData(data);

    const taskList = tasks
      .map((t) => {
        const start = t.startDate.slice(5).replace('-', '/');
        const end = t.endDate ? `〜${t.endDate.slice(5).replace('-', '/')}` : '〜';
        return `・${start}${end}: ${t.description}`;
      })
      .join('\n');

    await ctx.editReply(
      `✅ **${displayName}** のタスクを登録しました！\n\n**登録内容:**\n${taskList}`,
    );
    console.log(
      `[MemberProgressManager] Registered ${tasks.length} tasks for ${displayName}`,
    );
  }

  private getTodaysTasks(): { displayName: string; tasks: Task[] }[] {
    const data = this.loadData();
    const todayStr = new Date().toISOString().slice(0, 10);
    const result: { displayName: string; tasks: Task[] }[] = [];

    for (const member of Object.values(data.members)) {
      const todayTasks = member.tasks.filter((task) => {
        if (task.startDate > todayStr) return false;
        if (task.endDate !== null && task.endDate < todayStr) return false;
        return true;
      });

      if (todayTasks.length > 0) {
        result.push({ displayName: member.displayName, tasks: todayTasks });
      }
    }

    return result;
  }

  private async sendDailyCheck(): Promise<void> {
    const channelId =
      process.env.DISCORD_PROGRESS_CHANNEL_ID ||
      process.env.DISCORD_CHANNEL_ID ||
      '';
    if (!channelId) {
      console.warn('[MemberProgressManager] No channel ID configured. Skipping daily check.');
      return;
    }

    const membersWithTasks = this.getTodaysTasks();
    if (membersWithTasks.length === 0) {
      console.log('[MemberProgressManager] No tasks for today.');
      return;
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

    let message = `📋 **今日のタスク確認 (${dateStr})**\n\n`;
    for (const member of membersWithTasks) {
      message += `**${member.displayName}**\n`;
      for (const task of member.tasks) {
        message += `　・${task.description}\n`;
      }
      message += '\n';
    }

    await this.discordService.sendMessage(channelId, message);
    console.log('[MemberProgressManager] Daily check sent.');
  }

  public async initialize(): Promise<void> {
    this.cronJob = schedule('0 9 * * *', () => this.sendDailyCheck(), {
      timezone: 'Asia/Tokyo',
    });
    console.log('[MemberProgressManager] Scheduled: daily check at 9:00 JST');
  }

  public async execute(): Promise<void> {
    await this.sendDailyCheck();
  }

  public async shutdown(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[MemberProgressManager] Cron job stopped.');
    }
  }
}
