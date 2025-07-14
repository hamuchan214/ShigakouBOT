# デプロイメントガイド

このガイドでは、ShigakouBOTを本番環境にデプロイする方法を説明します。

## 前提条件

- Node.js 18以上
- npm または yarn
- Git
- プロキシサーバー（LXC、Docker、VPS等）

## デプロイ方法

### 1. LXCコンテナ（推奨）

#### コンテナの準備

```bash
# Ubuntu 22.04 LTSコンテナを作成
pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
  --hostname shigakou-bot \
  --memory 512 \
  --cores 1 \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --startup order=1
```

#### アプリケーションのセットアップ

```bash
# コンテナにアクセス
pct enter 100

# システムを更新
apt update && apt upgrade -y

# Node.jsをインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# プロジェクトディレクトリを作成
mkdir -p /opt/shigakou-bot
cd /opt/shigakou-bot

# プロジェクトをクローン
git clone https://github.com/your-username/ShigakouBOT.git .

# 依存関係をインストール
npm install

# ビルド
npm run build
```

#### 環境変数の設定

```bash
# .envファイルを作成
nano .env
```

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

#### systemdサービスの設定

```bash
# サービスファイルを作成
nano /etc/systemd/system/shigakou-bot.service
```

```ini
[Unit]
Description=ShigakouBOT Discord Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/shigakou-bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=TZ=Asia/Tokyo

[Install]
WantedBy=multi-user.target
```

#### サービスの起動

```bash
# systemdをリロード
systemctl daemon-reload

# サービスを有効化
systemctl enable shigakou-bot

# サービスを起動
systemctl start shigakou-bot

# ステータスを確認
systemctl status shigakou-bot
```

### 2. Docker

#### Dockerfileの作成

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 依存関係をコピー
COPY package*.json ./
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# 実行ユーザーを作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001

# 権限を変更
RUN chown -R bot:nodejs /app
USER bot

# アプリケーションを起動
CMD ["npm", "start"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  shigakou-bot:
    build: .
    container_name: shigakou-bot
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - TZ=Asia/Tokyo
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
```

#### デプロイ

```bash
# イメージをビルド
docker-compose build

# コンテナを起動
docker-compose up -d

# ログを確認
docker-compose logs -f
```

### 3. VPS/クラウドサーバー

#### サーバーの準備

```bash
# Ubuntu 22.04 LTSを想定
sudo apt update && sudo apt upgrade -y

# Node.jsをインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Gitをインストール
sudo apt install -y git

# PM2をインストール（プロセス管理）
sudo npm install -g pm2
```

#### アプリケーションのデプロイ

```bash
# プロジェクトをクローン
git clone https://github.com/your-username/ShigakouBOT.git
cd ShigakouBOT

# 依存関係をインストール
npm install

# ビルド
npm run build

# 環境変数を設定
cp .env.example .env
nano .env
```

#### PM2での管理

```bash
# PM2でアプリケーションを起動
pm2 start dist/index.js --name "shigakou-bot"

# 自動起動を有効化
pm2 startup
pm2 save

# ステータスを確認
pm2 status
pm2 logs shigakou-bot
```

## 監視とメンテナンス

### ログの確認

```bash
# systemdの場合
journalctl -u shigakou-bot -f

# Dockerの場合
docker-compose logs -f

# PM2の場合
pm2 logs shigakou-bot
```

### パフォーマンス監視

```bash
# メモリ使用量
free -h

# CPU使用量
top

# ディスク使用量
df -h
```

### バックアップ

```bash
# 設定ファイルのバックアップ
cp /opt/shigakou-bot/.env /backup/shigakou-bot.env.$(date +%Y%m%d)

# ログのローテーション
nano /etc/logrotate.d/shigakou-bot
```

## セキュリティ

### ファイアウォールの設定

```bash
# UFWを有効化
sudo ufw allow ssh
sudo ufw allow 22
sudo ufw enable
```

### SSL/TLS証明書（必要に応じて）

```bash
# Let's Encryptで証明書を取得
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
```

## トラブルシューティング

### よくある問題

1. **サービスが起動しない**
   - ログを確認: `journalctl -u shigakou-bot -n 50`
   - 環境変数が正しく設定されているか確認
   - 依存関係がインストールされているか確認

2. **メモリ不足**
   - コンテナのメモリ制限を増やす
   - 不要なプロセスを停止

3. **ネットワーク接続エラー**
   - ファイアウォールの設定を確認
   - DNSの設定を確認

### ログの場所

- **systemd**: `/var/log/journal/`
- **Docker**: `docker logs <container_name>`
- **PM2**: `~/.pm2/logs/`

## 更新手順

```bash
# コードを更新
git pull origin main

# 依存関係を更新
npm install

# ビルド
npm run build

# サービスを再起動
systemctl restart shigakou-bot
# または
docker-compose restart
# または
pm2 restart shigakou-bot
```

## 参考資料

- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Docker Documentation](https://docs.docker.com/) 