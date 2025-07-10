# Gmail to Discord Bot

このプロジェクトは、Gmailのメイン受信トレイに届いた新着メールを、指定したDiscordチャンネルに自動転送するBotです。TypeScriptとDiscord.js、Google Gmail APIを利用しています。

## 主な機能

- Gmailのメイン受信トレイに届いた新着メールのみを転送
- プロモーション、ソーシャル、更新、フォーラム等のカテゴリメールは除外
- Botが取得したメールは既読にせず、Gmail上の未読・既読状態は変更しません
- チェック間隔ごとに、その間に届いた新規メールのみを転送
- DiscordのEmbed形式でメール内容を通知
- 重複通知防止のため、同じメールは一度しか転送しません

## セットアップ手順

### 1. 依存パッケージのインストール

```
npm install
```

### 2. Google Cloud ConsoleでGmail APIの設定

1. Google Cloud Consoleで新規プロジェクトを作成
2. Gmail APIを有効化
3. OAuth 2.0クライアントID（デスクトップアプリ）を作成し、`credentials.json`をダウンロード
4. `credentials.json`内の`client_id`と`client_secret`を`.env`ファイルに転記
5. [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)等でリフレッシュトークンを取得し、`.env`に記載
6. 詳細な手順は`docs/gmail-setup.md`を参照

### 3. Discord Botの設定

1. Discord Developer PortalでBotを作成
2. Botトークンを取得し、`.env`に記載
3. Botをサーバーに招待し、必要な権限（メッセージ送信、埋め込みリンク等）を付与
4. 転送先チャンネルIDを`.env`に記載

### 4. .envファイルの例

```
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token_here
GMAIL_USER_ID=me
```

### 5. ビルドと起動

```
npm run build
npm start
```

## 動作仕様

- Botは5分ごと（デフォルト）にGmailをチェックします
- 前回チェック以降に届いたメールのみを転送します
- プロモーション等の不要なカテゴリはGmail APIの検索クエリと独自フィルタで除外します
- Botが取得したメールは既読にしません
- メールの件名・送信者・本文要約等をDiscordのEmbedで通知します

## カスタマイズ

- チェック間隔を変更したい場合は、`src/index.ts`の`setInterval`の値を編集してください
- Gmailの検索クエリをカスタマイズしたい場合は、`.env`の`GMAIL_QUERY`を編集してください（ただし、カテゴリ除外は必須です）

## ディレクトリ構成

```
src/
  index.ts                // メインアプリケーション
  types/
    index.ts              // 型定義
  services/
    gmailService.ts       // Gmail API処理
    discordService.ts     // Discord API処理
.env.example              // 環境変数サンプル
README.md                 // このファイル
```

## 注意事項

- 本BotはGmailのメイン受信トレイの通常メールのみを対象とし、広告・通知・SNS等のメールは通知しません
- Google/Gmail/Discordの仕様変更により動作しなくなる場合があります
- セキュリティのため、`.env`や`credentials.json`は絶対に公開しないでください

## ライセンス

MIT License 