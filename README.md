# Dミセ mobile

既存のシフト管理Webアプリ「Dミセ」のスタッフ向け機能を、iOS / Androidのネイティブアプリとして提供するExpoプロジェクトです。PWA移行ではなく、スタッフが日常的に使う操作をネイティブUIへ移植することを最優先にします。

## 現在の実装範囲

- Expo Routerのネイティブタブ（ホーム・シフト・打刻・その他）
- スタッフホーム、希望シフト提出、確定シフト、GPS打刻、通知、ヘルプ応募、勤怠後入力、プロフィール
- Supabase Authのメールアドレス・パスワード認証とSecureStoreセッション保存
- テナント/店舗切替、通知設定、Realtime通知、Expo Push Token登録
- RLSと認証必須RPCを利用したスタッフ本人データの読み書き
- Dミセのブランドアセットとライト / ダークテーマ
- `@expo/ui`、NativeTabs、Hapticsを利用したネイティブ操作

業務画面ではデモデータを表示せず、設定不足・所属なし・取得失敗を明示します。

## セットアップ

Node.js 22.13以上を使用します。

```bash
npm install
cp .env.example .env
npm start
```

`.env`には、WEB版の公開環境変数からネイティブ版で使用する値を入力します。

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_WEB_APP_URL=
EXPO_PUBLIC_APP_NAME=
EXPO_PUBLIC_EAS_PROJECT_ID=
EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=false
```

対応関係は [.env.example](./.env.example) に記載しています。`EXPO_PUBLIC_*`はアプリに埋め込まれるため、`service_role`、メール、SMTP、Expo Access Tokenなどの秘密値は設定しません。サーバー側の例は [supabase/.env.example](./supabase/.env.example) に分離しています。

## Supabase

スタッフ用の追加スキーマは `supabase/migrations/` が正本です。

- 勤怠打刻を原子的に保存するRPC
- 勤怠の後から入力・重複検証・監査ログRPC
- 端末別Push Tokenテーブルと本人限定RLS

2026-07-24時点で接続済みの`D-mise`プロジェクトへ適用済みです。Web版も同じDBを使うため、Web版リポジトリ側のmigration履歴と生成型を同期してください。

## 品質チェック

```bash
npm run lint
npm exec tsc -- --noEmit
npx expo install --check
npx expo config --type public
```

実装範囲、移植順序、未決事項は [docs/native-implementation-plan.md](./docs/native-implementation-plan.md) を参照してください。画像の管理方針は [assets/images/README.md](./assets/images/README.md) にまとめています。
