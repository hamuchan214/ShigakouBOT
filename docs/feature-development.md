# 機能開発ガイド

ここでは、ShigakouBOTに新しい機能を追加する方法を説明します。

## アーキテクチャ概要

ShigakouBOTはモジュラーアーキテクチャを採用しており、各機能は独立したモジュールとして実装されます。

### 主要コンポーネント

- **BotFeature**: 機能の基本インターフェース
- **FeatureManager**: 機能の管理と実行
- **EmailForwarder**: 現在実装済みのメール転送機能

## 新しい機能の追加手順

### 1. BotFeatureインターフェースの実装

```typescript
import { BotFeature } from '../types/botFeatures';

export class YourNewFeature implements BotFeature {
  public readonly name = 'yourNewFeature';
  
  async initialize(): Promise<void> {
    // APIクライアントの初期化
    // データベース接続
    // 設定の読み込み
  }
  
  async execute(): Promise<void> {
    // メインの処理ロジック
    // 定期的に実行される処理
  }
  
  async shutdown(): Promise<void> {
    // リソースのクリーンアップ
    // 接続の切断
  }
}
```

### 2. メインアプリケーションへの追加

```typescript
// src/index.ts
import { YourNewFeature } from './services/yourNewFeature';

class GmailDiscordBot {
  constructor() {
    this.featureManager = new FeatureManager();
    
    // 既存の機能
    this.featureManager.addFeature(new EmailForwarder());
    
    // 新しい機能を追加
    this.featureManager.addFeature(new YourNewFeature());
  }
}
```

## 実装例

### カレンダー通知機能の例

```typescript
// src/services/calendarNotifier.ts
import { BotFeature } from '../types/botFeatures';
import { DiscordService } from './discordService';

export class CalendarNotifier implements BotFeature {
  public readonly name = 'calendarNotifier';
  private discordService: DiscordService;
  
  constructor() {
    this.discordService = new DiscordService();
  }
  
  async initialize(): Promise<void> {
    await this.discordService.initialize();
    // Google Calendar APIの初期化
  }
  
  async execute(): Promise<void> {
    // 今日の予定を取得
    const events = await this.getTodayEvents();
    
    // 通知が必要な予定をフィルタリング
    const notifications = this.filterNotifications(events);
    
    // Discordに通知
    for (const notification of notifications) {
      await this.discordService.sendNotification(notification);
    }
  }
  
  async shutdown(): Promise<void> {
    await this.discordService.disconnect();
  }
  
  private async getTodayEvents(): Promise<Event[]> {
    // Google Calendar APIから予定を取得
  }
  
  private filterNotifications(events: Event[]): Notification[] {
    // 通知対象の予定をフィルタリング
  }
}
```

## ベストプラクティス

### 1. エラーハンドリング

```typescript
async execute(): Promise<void> {
  try {
    // メイン処理
  } catch (error) {
    console.error(`Error in ${this.name}:`, error);
    // エラーをログに記録
    // 必要に応じて管理者に通知
  }
}
```

### 2. 設定の外部化

```typescript
// .env
CALENDAR_NOTIFIER_ENABLED=true
CALENDAR_CHECK_INTERVAL=30
CALENDAR_NOTIFICATION_CHANNEL_ID=123456789

// 機能内で設定を読み込み
const enabled = process.env.CALENDAR_NOTIFIER_ENABLED === 'true';
```

### 3. ログ出力

```typescript
async execute(): Promise<void> {
  console.log(`[${this.name}] Starting execution`);
  
  // 処理
  
  console.log(`[${this.name}] Execution completed`);
}
```

## テスト

### 単体テストの例

```typescript
// tests/services/yourNewFeature.test.ts
import { YourNewFeature } from '../../src/services/yourNewFeature';

describe('YourNewFeature', () => {
  let feature: YourNewFeature;
  
  beforeEach(() => {
    feature = new YourNewFeature();
  });
  
  it('should initialize correctly', async () => {
    await expect(feature.initialize()).resolves.not.toThrow();
  });
  
  it('should execute without errors', async () => {
    await feature.initialize();
    await expect(feature.execute()).resolves.not.toThrow();
  });
});
```

## デプロイ

新しい機能を追加した後は、以下の手順でデプロイしてください：

1. コードをビルド
```bash
npm run build
```

2. テストを実行
```bash
npm test
```

3. 本番環境にデプロイ
```bash
# LXCコンテナの場合
systemctl restart gmail-discord-bot
```

## トラブルシューティング

### よくある問題

1. **機能が初期化されない**
   - 環境変数が正しく設定されているか確認
   - APIキーやトークンが有効か確認

2. **実行時にエラーが発生**
   - ログを確認してエラーの詳細を把握
   - 依存関係が正しくインストールされているか確認

3. **他の機能と競合**
   - 機能名が重複していないか確認
   - リソースの競合がないか確認

## 参考資料

- [Discord.js Documentation](https://discord.js.org/)
- [Google APIs Documentation](https://developers.google.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) 