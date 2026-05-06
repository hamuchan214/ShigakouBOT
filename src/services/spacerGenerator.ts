import { SlashCommandBuilder } from '@discordjs/builders';
import {
  Interaction,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from 'discord.js';
import { BotFeature } from '../types/botFeatures';
import { DiscordService } from './discordService';

type SpacerFormat = 'stl' | 'step';

/**
 * /spacer コマンドでスペーサーのCADファイルを生成する機能
 * 使い方: /spacer inner_diameter:<mm> outer_diameter:<mm> length:<mm> [format:stl|step]
 */
export class SpacerGenerator implements BotFeature {
  public name = 'spacerGenerator';

  constructor(discordService: DiscordService) {
    const command = new SlashCommandBuilder()
      .setName('spacer')
      .setDescription('スペーサーのCADファイルを生成します')
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
      )
      .addStringOption((opt) =>
        opt
          .setName('format')
          .setDescription('出力フォーマット (デフォルト: step)')
          .setRequired(false)
          .addChoices(
            { name: 'STEP (CAD形式・Fusion 360推奨)', value: 'step' },
            { name: 'STL (メッシュ形式・3Dプリンタ向け)', value: 'stl' },
          ),
      );

    discordService.addExternalCommand(
      command as unknown as SlashCommandBuilder,
      this.handleCommand.bind(this),
    );
  }

  // ──────────────────────────────────────────────────────────────
  // STL 生成 (バイナリ形式)
  // ──────────────────────────────────────────────────────────────

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

    const buf = Buffer.alloc(80 + 4 + numTriangles * 50);
    let pos = 0;

    const header = `Spacer ID=${innerDiameter}mm OD=${outerDiameter}mm L=${length}mm`;
    buf.write(header.padEnd(80, '\0').slice(0, 80), pos, 'ascii');
    pos += 80;
    buf.writeUInt32LE(numTriangles, pos);
    pos += 4;

    const wf = (v: number) => { buf.writeFloatLE(v, pos); pos += 4; };
    const wVec = (x: number, y: number, z: number) => { wf(x); wf(y); wf(z); };
    type V3 = [number, number, number];

    const writeTri = (n: V3, v1: V3, v2: V3, v3: V3) => {
      wVec(...n); wVec(...v1); wVec(...v2); wVec(...v3);
      buf.writeUInt16LE(0, pos); pos += 2;
    };

    for (let i = 0; i < segments; i++) {
      const a1 = (2 * Math.PI * i) / segments;
      const a2 = (2 * Math.PI * (i + 1)) / segments;
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const c2 = Math.cos(a2), s2 = Math.sin(a2);

      writeTri([c1, s1, 0], [ro*c1, ro*s1, 0], [ro*c2, ro*s2, 0], [ro*c1, ro*s1, h]);
      writeTri([c2, s2, 0], [ro*c2, ro*s2, 0], [ro*c2, ro*s2, h], [ro*c1, ro*s1, h]);
      writeTri([-c1, -s1, 0], [ri*c1, ri*s1, 0], [ri*c1, ri*s1, h], [ri*c2, ri*s2, 0]);
      writeTri([-c2, -s2, 0], [ri*c2, ri*s2, 0], [ri*c1, ri*s1, h], [ri*c2, ri*s2, h]);
      writeTri([0, 0, 1], [ro*c1, ro*s1, h], [ro*c2, ro*s2, h], [ri*c2, ri*s2, h]);
      writeTri([0, 0, 1], [ro*c1, ro*s1, h], [ri*c2, ri*s2, h], [ri*c1, ri*s1, h]);
      writeTri([0, 0, -1], [ro*c1, ro*s1, 0], [ri*c2, ri*s2, 0], [ro*c2, ro*s2, 0]);
      writeTri([0, 0, -1], [ro*c1, ro*s1, 0], [ri*c1, ri*s1, 0], [ri*c2, ri*s2, 0]);
    }

    return buf;
  }

  // ──────────────────────────────────────────────────────────────
  // STEP AP214 生成 (B-rep / 厳密形状)
  //
  // 構成:
  //   外周面  CYLINDRICAL_SURFACE same_sense=.T.  (法線: 外向き)
  //   内周面  CYLINDRICAL_SURFACE same_sense=.F.  (法線: 内向き)
  //   上面    PLANE (z=h)  ADVANCED_FACE with outer + inner loop
  //   下面    PLANE (z=0, 法線 -Z)  ADVANCED_FACE with outer + inner loop
  // ──────────────────────────────────────────────────────────────

  private generateSpacerSTEP(
    innerDiameter: number,
    outerDiameter: number,
    length: number,
  ): string {
    const ri = innerDiameter / 2;
    const ro = outerDiameter / 2;
    const h  = length;

    const lines: string[] = [];
    let n = 1;

    // エンティティを追加して ID を返す
    const e = (def: string): number => {
      lines.push(`#${n} = ${def};`);
      return n++;
    };

    // STEP では整数は "30." のように小数点を付ける必要がある
    const f = (v: number): string =>
      Number.isInteger(v) ? `${v}.` : String(v);

    // ---- 点 ----
    const pOrigin     = e(`CARTESIAN_POINT('',(0.,0.,0.))`);
    const pOuterBotSm = e(`CARTESIAN_POINT('',(${f(ro)},0.,0.))`);
    const pOuterTopSm = e(`CARTESIAN_POINT('',(${f(ro)},0.,${f(h)}))`);
    const pInnerBotSm = e(`CARTESIAN_POINT('',(${f(ri)},0.,0.))`);
    const pInnerTopSm = e(`CARTESIAN_POINT('',(${f(ri)},0.,${f(h)}))`);
    const pTopCenter  = e(`CARTESIAN_POINT('',(0.,0.,${f(h)}))`);

    // ---- 方向ベクトル ----
    const dZUp   = e(`DIRECTION('',(0.,0.,1.))`);
    const dXPos  = e(`DIRECTION('',(1.,0.,0.))`);
    const dZDown = e(`DIRECTION('',(0.,0.,-1.))`);

    // ---- 方向付きベクトル (LINE用) ----
    const vZUp = e(`VECTOR('',#${dZUp},1.)`);

    // ---- 軸配置 ----
    // axBotZUp  : 原点, 法線 +Z (外周面・内周面の軸 / 底面の円弧 / 上面の円弧)
    // axTopZUp  : 上面中心, 法線 +Z (上面 PLANE / 上面円弧)
    // axBotZDown: 原点, 法線 -Z (下面 PLANE)
    const axBotZUp   = e(`AXIS2_PLACEMENT_3D('',#${pOrigin},#${dZUp},#${dXPos})`);
    const axTopZUp   = e(`AXIS2_PLACEMENT_3D('',#${pTopCenter},#${dZUp},#${dXPos})`);
    const axBotZDown = e(`AXIS2_PLACEMENT_3D('',#${pOrigin},#${dZDown},#${dXPos})`);

    // ---- 曲線 ----
    const circOuterBot = e(`CIRCLE('',#${axBotZUp},${f(ro)})`);
    const circOuterTop = e(`CIRCLE('',#${axTopZUp},${f(ro)})`);
    const lineOuterSm  = e(`LINE('',#${pOuterBotSm},#${vZUp})`);
    const circInnerBot = e(`CIRCLE('',#${axBotZUp},${f(ri)})`);
    const circInnerTop = e(`CIRCLE('',#${axTopZUp},${f(ri)})`);
    const lineInnerSm  = e(`LINE('',#${pInnerBotSm},#${vZUp})`);

    // ---- 曲面 ----
    const surfOuterCyl = e(`CYLINDRICAL_SURFACE('',#${axBotZUp},${f(ro)})`);
    const surfInnerCyl = e(`CYLINDRICAL_SURFACE('',#${axBotZUp},${f(ri)})`);
    const surfTopPlane = e(`PLANE('',#${axTopZUp})`);
    const surfBotPlane = e(`PLANE('',#${axBotZDown})`);

    // ---- 頂点 ----
    const vOuterBot = e(`VERTEX_POINT('',#${pOuterBotSm})`);
    const vOuterTop = e(`VERTEX_POINT('',#${pOuterTopSm})`);
    const vInnerBot = e(`VERTEX_POINT('',#${pInnerBotSm})`);
    const vInnerTop = e(`VERTEX_POINT('',#${pInnerTopSm})`);

    // ---- 辺 ----
    // 閉円弧は start=end=継ぎ目頂点
    const eOuterBotC = e(`EDGE_CURVE('',#${vOuterBot},#${vOuterBot},#${circOuterBot},.T.)`);
    const eOuterTopC = e(`EDGE_CURVE('',#${vOuterTop},#${vOuterTop},#${circOuterTop},.T.)`);
    const eOuterSm   = e(`EDGE_CURVE('',#${vOuterBot},#${vOuterTop},#${lineOuterSm},.T.)`);
    const eInnerBotC = e(`EDGE_CURVE('',#${vInnerBot},#${vInnerBot},#${circInnerBot},.T.)`);
    const eInnerTopC = e(`EDGE_CURVE('',#${vInnerTop},#${vInnerTop},#${circInnerTop},.T.)`);
    const eInnerSm   = e(`EDGE_CURVE('',#${vInnerBot},#${vInnerTop},#${lineInnerSm},.T.)`);

    // ---- 外周面 (same_sense=.T., 法線: 外向き) ----
    // ループ: 継ぎ目上り → 上円弧 → 継ぎ目下り → 下円弧逆
    const oe1  = e(`ORIENTED_EDGE('',*,*,#${eOuterSm},.T.)`);
    const oe2  = e(`ORIENTED_EDGE('',*,*,#${eOuterTopC},.T.)`);
    const oe3  = e(`ORIENTED_EDGE('',*,*,#${eOuterSm},.F.)`);
    const oe4  = e(`ORIENTED_EDGE('',*,*,#${eOuterBotC},.F.)`);
    const el1  = e(`EDGE_LOOP('',(#${oe1},#${oe2},#${oe3},#${oe4}))`);
    const fob1 = e(`FACE_OUTER_BOUND('',#${el1},.T.)`);
    const f1   = e(`ADVANCED_FACE('OuterCyl',(#${fob1}),#${surfOuterCyl},.T.)`);

    // ---- 内周面 (same_sense=.F. で法線を内向きに反転) ----
    const oe5  = e(`ORIENTED_EDGE('',*,*,#${eInnerSm},.T.)`);
    const oe6  = e(`ORIENTED_EDGE('',*,*,#${eInnerTopC},.T.)`);
    const oe7  = e(`ORIENTED_EDGE('',*,*,#${eInnerSm},.F.)`);
    const oe8  = e(`ORIENTED_EDGE('',*,*,#${eInnerBotC},.F.)`);
    const el2  = e(`EDGE_LOOP('',(#${oe5},#${oe6},#${oe7},#${oe8}))`);
    const fob2 = e(`FACE_OUTER_BOUND('',#${el2},.T.)`);
    const f2   = e(`ADVANCED_FACE('InnerCyl',(#${fob2}),#${surfInnerCyl},.F.)`);

    // ---- 上面 (z=h, 法線 +Z, 輪環形) ----
    // 外側ループ: 外周上円弧 正向き (CCW from +Z)
    // 内側ループ: 内周上円弧 逆向き (CW from +Z = 穴)
    const oe9  = e(`ORIENTED_EDGE('',*,*,#${eOuterTopC},.T.)`);
    const el3  = e(`EDGE_LOOP('',(#${oe9}))`);
    const fob3 = e(`FACE_OUTER_BOUND('',#${el3},.T.)`);
    const oe10 = e(`ORIENTED_EDGE('',*,*,#${eInnerTopC},.F.)`);
    const el4  = e(`EDGE_LOOP('',(#${oe10}))`);
    const fb4  = e(`FACE_BOUND('',#${el4},.T.)`);
    const f3   = e(`ADVANCED_FACE('TopFace',(#${fob3},#${fb4}),#${surfTopPlane},.T.)`);

    // ---- 下面 (z=0, 法線 -Z, 輪環形) ----
    // 外側ループ: 外周下円弧 逆向き (CW from +Z = CCW from -Z)
    // 内側ループ: 内周下円弧 正向き (CCW from +Z = CW from -Z = 穴)
    const oe11 = e(`ORIENTED_EDGE('',*,*,#${eOuterBotC},.F.)`);
    const el5  = e(`EDGE_LOOP('',(#${oe11}))`);
    const fob5 = e(`FACE_OUTER_BOUND('',#${el5},.T.)`);
    const oe12 = e(`ORIENTED_EDGE('',*,*,#${eInnerBotC},.T.)`);
    const el6  = e(`EDGE_LOOP('',(#${oe12}))`);
    const fb6  = e(`FACE_BOUND('',#${el6},.T.)`);
    const f4   = e(`ADVANCED_FACE('BottomFace',(#${fob5},#${fb6}),#${surfBotPlane},.T.)`);

    // ---- シェルとソリッド ----
    const shell = e(`CLOSED_SHELL('',(#${f1},#${f2},#${f3},#${f4}))`);
    const solid = e(`MANIFOLD_SOLID_BREP('Spacer',#${shell})`);

    // ---- 単位系 (mm, radian, steradian) ----
    const mmUnit   = e(`(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))`);
    const radUnit  = e(`(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))`);
    const sterUnit = e(`(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())`);
    const uncert   = e(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#${mmUnit},'distance_accuracy_value','confusion accuracy')`);
    const ctx      = e(`(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${uncert})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${mmUnit},#${radUnit},#${sterUnit})) REPRESENTATION_CONTEXT('ID1','3D'))`);

    // ---- プロダクト情報 ----
    const appCtx   = e(`APPLICATION_CONTEXT('automotive design')`);
    const prodCtx  = e(`PRODUCT_CONTEXT('',#${appCtx},'mechanical')`);
    const prod     = e(`PRODUCT('Spacer','Spacer','',(#${prodCtx}))`);
    const prodForm = e(`PRODUCT_DEFINITION_FORMATION('','',#${prod})`);
    const defCtx   = e(`PRODUCT_DEFINITION_CONTEXT('part definition',#${appCtx},'design')`);
    const prodDef  = e(`PRODUCT_DEFINITION('design','',#${prodForm},#${defCtx})`);
    const shapeRep = e(`ADVANCED_BREP_SHAPE_REPRESENTATION('Spacer',(#${solid}),#${ctx})`);
    const prodSh   = e(`PRODUCT_DEFINITION_SHAPE('Nominal','',#${prodDef})`);
    /* void */ e(`SHAPE_DEFINITION_REPRESENTATION(#${prodSh},#${shapeRep})`);

    const name = `spacer_ID${innerDiameter}_OD${outerDiameter}_L${length}.stp`;
    return [
      'ISO-10303-21;',
      'HEADER;',
      `FILE_DESCRIPTION(('ShigakouBOT Spacer ID=${innerDiameter}mm OD=${outerDiameter}mm L=${length}mm'),'2;1');`,
      `FILE_NAME('${name}','',(''),(''),'ShigakouBOT','','');`,
      `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`,
      'ENDSEC;',
      'DATA;',
      ...lines,
      'ENDSEC;',
      'END-ISO-10303-21;',
    ].join('\n');
  }

  // ──────────────────────────────────────────────────────────────
  // Discord コマンドハンドラ
  // ──────────────────────────────────────────────────────────────

  private async handleCommand(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const ctx = interaction as ChatInputCommandInteraction;

    const innerDiameter = ctx.options.getNumber('inner_diameter', true);
    const outerDiameter = ctx.options.getNumber('outer_diameter', true);
    const length        = ctx.options.getNumber('length', true);
    const format        = (ctx.options.getString('format') ?? 'step') as SpacerFormat;

    if (innerDiameter >= outerDiameter) {
      await ctx.reply({
        content: '⚠️ 内径は外径より小さい値にしてください。',
        ephemeral: true,
      });
      return;
    }

    await ctx.deferReply();

    let buffer: Buffer;
    let fileName: string;

    if (format === 'step') {
      buffer   = Buffer.from(this.generateSpacerSTEP(innerDiameter, outerDiameter, length), 'utf-8');
      fileName = `spacer_ID${innerDiameter}_OD${outerDiameter}_L${length}.step`;
    } else {
      buffer   = this.generateSpacerSTL(innerDiameter, outerDiameter, length);
      fileName = `spacer_ID${innerDiameter}_OD${outerDiameter}_L${length}.stl`;
    }

    const attachment = new AttachmentBuilder(buffer, { name: fileName });

    const formatNote = format === 'step'
      ? '> STEP形式 / Fusion 360 では **ファイル挿入 → メッシュを挿入** ではなく **開く** から読み込んでください。'
      : '> STL形式 / Fusion 360 でインポートする際は単位を **mm** に設定してください。';

    await ctx.editReply({
      content: [
        `✅ **スペーサー ${format.toUpperCase()} 生成完了**`,
        `　内径: **${innerDiameter} mm**`,
        `　外径: **${outerDiameter} mm**`,
        `　長さ: **${length} mm**`,
        '',
        formatNote,
      ].join('\n'),
      files: [attachment],
    });

    console.log(
      `[SpacerGenerator] Generated ${format.toUpperCase()}: ID=${innerDiameter} OD=${outerDiameter} L=${length}`,
    );
  }

  public async initialize(): Promise<void> {}
  public async execute(): Promise<void> {}
  public async shutdown(): Promise<void> {}
}
