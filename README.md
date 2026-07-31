# Discord動画埋め込みBot — Koyeb Buildpack版 v1.6

Koyebのエラー:

```text
Missing lockfile
Couldn't determine Node.js package manager
```

を修正した版です。

## 修正内容

- `package-lock.json` を追加
- Dockerfileは使用しない
- Koyeb Buildpackでデプロイ
- 外部npm依存を0個に変更
- Node.js標準WebSocketでDiscord Gatewayへ接続
- ニコニコ動画とBilibiliに対応

## GitHubへアップロードする7ファイル

- README.md
- index.js
- koyeb-keepalive.gs
- link-utils.js
- package-lock.json
- package.json
- test.js

前に追加した `Dockerfile` がGitHubにある場合は削除してください。

## Koyeb設定

```text
Builder: Buildpack
Run command: npm start
Port: 8000
Protocol: HTTP
Route: /
```

Environment:

```text
DISCORD_TOKEN = Reset後の新しいBot Token
```

Health check:

```text
Method: GET
Path: /health
```

保存後にRedeployしてください。

## Discord Developer Portal

Bot → Privileged Gateway Intents:

```text
Message Content Intent = ON
```

必要なBot権限:

- View Channels
- Send Messages
- Embed Links
- Read Message History

## 成功ログ

```text
Resolved Node.js version: 22.15.1
Installing dependencies
npm start
✅ HTTP server listening on 0.0.0.0:8000
Discord Gatewayへ接続します。
✅ Bot名 がオンラインになりました。
```

## GAS

`koyeb-keepalive.gs` のURLを実際のKoyeb URLへ変更します。

```javascript
'https://YOUR-KOYEB-APP.koyeb.app/health'
```


## v1.5変更点

Bilibili変換URLへ `?lang=jp` を付けないように変更しました。

```text
https://www.bilibili.com/video/BV1xx411c7mD
↓
https://www.vxbilibili.com/video/BV1xx411c7mD
```

```text
https://b23.tv/AbCd123
↓
https://vxb23.tv/AbCd123
```

`p` や `t` が元URLに含まれる場合は、その値だけ保持します。


## v1.6変更点

元のニコニコ・Bilibili URLが作る埋め込みを非表示にし、
Botが返信した変換URL側の埋め込みだけを表示します。

元メッセージ本文とURLは削除しません。

### 追加権限

Botへ次の権限を付けてください。

```text
メッセージの管理（Manage Messages）
```

権限がない場合、変換URLは返信しますが元URLの埋め込みは残ります。
