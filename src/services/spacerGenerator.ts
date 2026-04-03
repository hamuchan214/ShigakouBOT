import { SlashCommandBuilder } from '@discordjs/builders';
import {
  Interaction,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from 'discord.js';
import { BotFeature } from '../types/botFeatures';
import { DiscordService } from './discordService';

/**
 * /spacer コマンドでスペーサーのSTLファイルを生成する機能
 * 使い方: /spacer inner_diameter:<mm> outer_diameter:<mm> length:<mm>
 */
export class SpacerGenerator implements BotFeature {
  public name = 'spacerGenerator';

  constructor(discordService: DiscordService) {
    const command = new SlashCommandBuilder()
      .setName('spacer')
      .setDescription('スペーサーのSTLファイルを生成します')
      .addNumberOption((opt) =>
        opt
          .setName('inner_diameter')
          .setDescription('内径 (mm)')
          .setRequired(true)
          .setMinValue(0.1),
      )
      .addNumberOption((opt) =>
        opt
          .setName('outer_diameter')
          .setDescription('外径 (mm)')
          .setRequired(true)
          .setMinValue(0.1),
      )
      .addNumberOption((opt) =>
        opt
          .setName('length')
          .setDescription('長さ (mm)')
          .setRequired(true)
          .setMinValue(0.1),
      );

    discordService.addExternalCommand(
      command as unknown as SlashCommandBuilder,
      this.handleCommand.bind(this),
    );
  }

  /**
   * バイナリ STL を生成する。
   * 中空円柱（スペーサー）のメッシュを分割数 segments で近似する。
   *
   * メッシュ構成:
   *   外周面 (outward normal)  : segments × 2 三角形
   *   内周面 (inward normal)   : segments × 2 三角形
   *   上面 annular ring        : segments × 2 三角形
   *   下面 annular ring        : segments × 2 三角形
   */
  private generateSpacerSTL(
    innerDiameter: number,
    outerDiameter: number,
    length: number,
    segments = 64,
  ): Buffer {
    const ri = innerDiameter / 2;
    const ro = outerDiameter / 2;
    const h = length;
    const numTriangles = segments * 8;

    // Binary STL: 80 byte header + 4 byte count + 50 bytes/triangle
    const buf = Buffer.alloc(80 + 4 + numTriangles * 50);
    let pos = 0;

    // Header
    const header = `Spacer ID=${innerDiameter}mm OD=${outerDiameter}mm L=${length}mm`;
    buf.write(header.padEnd(80, '\0').slice(0, 80), pos, 'ascii');
    pos += 80;

    buf.writeUInt32LE(numTriangles, pos);
    pos += 4;

    const wf = (v: number) => { buf.writeFloatLE(v, pos); pos += 4; };
    const wVec = (x: number, y: number, z: number) => { wf(x); wf(y); wf(z); };
    type V3 = [number, number, number];

    const writeTri = (n: V3, v1: V3, v2: V3, v3: V3) => {
      wVec(...n);
      wVec(...v1);
      wVec(...v2);
      wVec(...v3);
      buf.writeUInt16LE(0, pos); pos += 2; // attribute byte count
    };

    for (let i = 0; i < segments; i++) {
      const a1 = (2 * Math.PI * i) / segments;
      const a2 = (2 * Math.PI * (i + 1)) / segments;
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const c2 = Math.cos(a2), s2 = Math.sin(a2);

      // ---- 外周面 (法線: 外向き) ----
      writeTri(
        [c1, s1, 0],
        [ro * c1, ro * s1, 0],
        [ro * c2, ro * s2, 0],
        [ro * c1, ro * s1, h],
      );
      writeTri(
        [c2, s2, 0],
        [ro * c2, ro * s2, 0],
        [ro * c2, ro * s2, h],
        [ro * c1, ro * s1, h],
      );

      // ---- 内周面 (法線: 内向き = 外向きの逆) ----
      writeTri(
        [-c1, -s1, 0],
        [ri * c1, ri * s1, 0],
        [ri * c1, ri * s1, h],
        [ri * c2, ri * s2, 0],
      );
      writeTri(
        [-c2, -s2, 0],
        [ri * c2, ri * s2, 0],
        [ri * c1, ri * s1, h],
        [ri * c2, ri * s2, h],
      );

      // ---- 上面 (z=h, 法線: +Z) ----
      writeTri(
        [0, 0, 1],
        [ro * c1, ro * s1, h],
        [ro * c2, ro * s2, h],
        [ri * c2, ri * s2, h],
      );
      writeTri(
        [0, 0, 1],
        [ro * c1, ro * s1, h],
        [ri * c2, ri * s2, h],
        [ri * c1, ri * s1, h],
      );

      // ---- 下面 (z=0, 法線: -Z) ----
      writeTri(
        [0, 0, -1],
        [ro * c1, ro * s1, 0],
        [ri * c2, ri * s2, 0],
        [ro * c2, ro * s2, 0],
      );
      writeTri(
        [0, 0, -1],
        [ro * c1, ro * s1, 0],
        [ri * c1, ri * s1, 0],
        [ri * c2, ri * s2, 0],
      );
    }

    return buf;
  }

  private async handleCommand(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const ctx = interaction as ChatInputCommandInteraction;

    const innerDiameter = ctx.options.getNumber('inner_diameter', true);
    const outerDiameter = ctx.options.getNumber('outer_diameter', true);
    const length = ctx.options.getNumber('length', true);

    if (innerDiameter >= outerDiameter) {
      await ctx.reply({
        content: '⚠️ 内径は外径より小さい値にしてください。',
        ephemeral: true,
      });
      return;
    }

    await ctx.deferReply();

    const stlBuffer = this.generateSpacerSTL(innerDiameter, outerDiameter, length);
    const fileName = `spacer_ID${innerDiameter}_OD${outerDiameter}_L${length}.stl`;
    const attachment = new AttachmentBuilder(stlBuffer, { name: fileName });

    await ctx.editReply({
      content: [
        '✅ **スペーサーSTL生成完了**',
        `　内径: **${innerDiameter} mm**`,
        `　外径: **${outerDiameter} mm**`,
        `　長さ: **${length} mm**`,
        '',
        '> ⚠️ Fusion 360 でインポートする際は、単位を **mm** に設定してください。',
        '> （cm のままだと10倍のサイズになります）',
      ].join('\n'),
      files: [attachment],
    });

    console.log(
      `[SpacerGenerator] Generated STL: ID=${innerDiameter} OD=${outerDiameter} L=${length}`,
    );
  }

  public async initialize(): Promise<void> {}
  public async execute(): Promise<void> {}
  public async shutdown(): Promise<void> {}
}
