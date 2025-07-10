# Gmail API セットアップガイド

このガイドでは、Gmail to Discord Botで使用するGmail APIの設定手順を説明します。

## 手順

### 1. Google Cloud Consoleでプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成（例：`gmail-discord-bot`）
3. プロジェクトを選択

### 2. Gmail APIを有効化

1. 左側のメニューから「APIとサービス」→「ライブラリ」を選択
2. 検索バーで「Gmail API」を検索
3. Gmail APIを選択して「有効にする」をクリック

### 3. OAuth 2.0クレデンシャルを作成

1. 「APIとサービス」→「認証情報」を選択
2. 「認証情報を作成」→「OAuth 2.0クライアントID」を選択
3. アプリケーションの種類で「デスクトップアプリケーション」を選択
4. 名前を入力（例：`Gmail Discord Bot`）
5. 「作成」をクリック

### 4. クライアントIDとクライアントシークレットを取得

作成されたOAuth 2.0クレデンシャルの詳細ページで以下を確認：
- **クライアントID**: `your_client_id_here`
- **クライアントシークレット**: `your_client_secret_here`

### 5. リフレッシュトークンを取得

#### 方法1: Google OAuth 2.0 Playgroundを使用

1. [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)にアクセス
2. 右上の設定アイコン（⚙️）をクリック
3. 「Use your own OAuth credentials」にチェック
4. クライアントIDとクライアントシークレットを入力
5. 左側のリストから「Gmail API v1」→「https://mail.google.com/」を選択
6. 「Authorize APIs」をクリック
7. Googleアカウントでログインし、権限を許可
8. 「Exchange authorization code for tokens」をクリック
9. **リフレッシュトークン**をコピー

#### 方法2: Node.jsスクリプトを使用

以下のスクリプトを作成して実行：

```javascript
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:3000/oauth2callback'
);

const scopes = [
  'https://mail.google.com/'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

console.log('Authorize this app by visiting this url:', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code from that page here: ', (code) => {
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) return console.error('Error retrieving access token', err);
    console.log('Refresh token:', tokens.refresh_token);
    rl.close();
  });
});
```

### 6. 環境変数に設定

取得した値を`.env`ファイルに設定：

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REFRESH_TOKEN=your_refresh_token_here
```

## トラブルシューティング

### よくある問題

1. **「APIが有効化されていません」エラー**
   - Gmail APIが正しく有効化されているか確認
   - プロジェクトが正しく選択されているか確認

2. **「無効なクレデンシャル」エラー**
   - クライアントIDとクライアントシークレットが正しいか確認
   - リフレッシュトークンが正しく取得されているか確認

3. **「スコープが不足しています」エラー**
   - Gmail APIのスコープ（`https://mail.google.com/`）が含まれているか確認

4. **リフレッシュトークンが期限切れ**
   - リフレッシュトークンは通常長期間有効ですが、セキュリティ設定によっては期限切れになる場合があります
   - 上記の手順で新しいリフレッシュトークンを取得してください

## セキュリティのベストプラクティス

1. **クレデンシャルの保護**
   - `.env`ファイルをGitにコミットしない
   - 本番環境では環境変数として設定

2. **最小権限の原則**
   - 必要最小限のスコープのみを要求
   - 不要な権限は削除

3. **定期的な更新**
   - リフレッシュトークンを定期的に更新
   - クレデンシャルを定期的にローテーション

## 参考リンク

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) 