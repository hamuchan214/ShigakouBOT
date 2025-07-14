# ShigakouBOT

TypeScriptとDiscord.jsで作成された拡張可能なDiscord Botです。現在はGmail転送機能を実装しており、将来的に様々な機能を追加できるモジュラーアーキテクチャを採用しています。

## 主な機能

### 現在実装済み
- **Gmail to Discord 転送機能**: Gmailの新着メールをDiscordチャンネルに自動転送
  - プロモーションメールの自動除外
  - 1分ごとの定期チェック
  - メールの既読状態を保持

### 将来予定
- カレンダー通知機能
- タスク管理機能
- その他の自動化機能

## 技術スタック

- **TypeScript**: 型安全性と開発効率の向上
- **Discord.js**: Discord APIとの統合
- **Google Gmail API**: メール取得と処理
- **モジュラーアーキテクチャ**: 機能の独立と拡張性

## クイックスタート

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、必要な認証情報を設定してください：

```env
# Discord Bot設定
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here

# Gmail API設定
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token_here
GMAIL_USER_ID=me
```

### 3. ビルドと実行

```bash
# TypeScriptをビルド
npm run build

# 開発環境で実行
npm run dev

# 本番環境で実行
npm start
```

## プロジェクト構造

```
src/
├── index.ts                    # メインアプリケーション
├── types/
│   ├── index.ts               # 基本型定義
│   └── botFeatures.ts         # 機能拡張用インターフェース
└── services/
    ├── gmailService.ts        # Gmail API処理
    ├── discordService.ts      # Discord API処理
    ├── emailForwarder.ts      # メール転送機能
    └── featureManager.ts      # 機能管理
```

## 機能の追加方法

新しい機能を追加する場合は、`BotFeature`インターフェースを実装してください：

```typescript
import { BotFeature } from '../types/botFeatures';

export class YourNewFeature implements BotFeature {
  public readonly name = 'yourNewFeature';
  
  async initialize(): Promise<void> {
    // 初期化処理
  }
  
  async execute(): Promise<void> {
    // メイン処理
  }
  
  async shutdown(): Promise<void> {
    // クリーンアップ処理
  }
}
```

## 開発

### 利用可能なスクリプト

```bash
npm run build      # TypeScriptをビルド
npm run dev        # 開発環境で実行
npm start          # 本番環境で実行
npm run watch      # ファイル変更を監視してビルド
```

### デプロイ

LXCコンテナへのデプロイ手順は`docs/deployment.md`を参照してください。

## ドキュメント

詳細なドキュメントは`docs/`ディレクトリにあります：

- [Gmail API セットアップ](./docs/gmail-setup.md)
- [デプロイメントガイド](./docs/deployment.md)
- [機能開発ガイド](./docs/feature-development.md)

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。新しい機能の提案やバグ報告もお気軽にお知らせください。 