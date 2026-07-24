# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このプロジェクトについて

Expo SDK 57 / React Native によるスタッフ向けネイティブアプリ **Dミセ**（`digital-shifts-mobile`）。既存のNext.js Webアプリ（`digital-shifts-webapp`）のスタッフ機能を*移植*したもので、PWAラッパーではない。両アプリは**同一のSupabaseデータベース**を共有するため、ここでのスキーマ変更はWeb版リポジトリのmigration履歴と生成型へ必ず同期する。

管理者向け機能（シフト作成、給与計算、請求、developerコンソール、PWAインストール導線）は明確に対象外。UI文言とコードコメントは日本語で統一されているので、そのまま日本語で書く。

## コマンド

```bash
npm install
npm start                     # Expo開発サーバー
npm run ios / android / web
npm run lint                  # expo lint（eslint-config-expo flat config）
npx tsc --noEmit              # strict TypeScript検証
npx expo install --check      # Expo互換の依存バージョン確認
npx expo config --type public # 解決済みExpo設定の検証
```

テストランナーは未設定。`npm run lint` と `npx tsc --noEmit`、および `git diff --check` がPR前の必須チェック。Node 22.13以上。

`.env`（`.env.example`からコピー）に `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` が必要。未設定でもクラッシュせず、設定不足の状態表示になる（`isSupabaseConfigured` を参照）。

## アーキテクチャ

### Providerの階層（`src/app/_layout.tsx`）

`AppQueryProvider` → `SessionProvider` → `StaffProvider` → 各observer → `RootNavigator`。配下のコードはこの順序を前提にしており、`useStaff()` / `useSession()` はProvider外で呼ぶとthrowする。

- **`AppQueryProvider`**（`src/lib/query-provider.tsx`）: TanStack QueryをReact Nativeのライフサイクルへ接続する。NetInfo → `onlineManager`、`AppState` → `focusManager`。既定値は staleTime 30秒、queryは2回リトライ、mutationはリトライなし。
- **`SessionProvider`**（`src/features/auth/session-provider.tsx`）: Supabaseセッションを復元し、`onAuthStateChange` を購読、`AppState` に応じて `autoRefresh` を開始/停止する。
- **`StaffProvider`**（`src/features/staff/staff-provider.tsx`）: プロフィール・テナント・店舗を1クエリで取得し、**選択中のテナント/店舗**を保持する。選択はユーザー単位でAsyncStorageの `staff:${userId}:tenant` / `:store` に永続化。テナントを切り替えると店舗選択はクリアされる。

### ルート保護

認証ガードはroot layoutの `<Stack.Protected guard={...}>` による宣言的な仕組みで、リダイレクト用のmiddlewareは存在しない。`src/app/index.tsx` は `/(staff)/(home)` か `/(auth)/sign-in` へリダイレクトするだけ。モーダル/シートの表示形式（`modal`、detent付き `formSheet`）はroot Stackの `Stack.Screen` 側で設定している。

### ルートと画面の分離

`src/app/**` のファイルは画面の1行再エクスポート（`export default HomeScreen`）。表示処理はすべて `src/screens/<name>/index.tsx` にある。**ルートファイルは薄く保つ** — データアクセスや業務ルールを置かないこと。`src/app/(staff)/_layout.tsx` は `expo-router/unstable-native-tabs` の `NativeTabs` を使い、SF Symbols（`sf`）とMaterial（`md`）のアイコンを対で指定する。通知タブのバッジは `useNotifications()` から算出している。

### データ層は3層に厳密に分ける

1. **`src/features/staff/api.ts`** — `supabase` に触れる唯一のファイル。すべての関数が `requireSupabase()` を通り（未設定時は日本語エラーをthrow）、snake_caseのDB行を `types.ts` のcamelCaseドメイン型へ変換する。ネストした単一リレーションは配列かオブジェクトで返るため `one()` ヘルパーを通す。
2. **`src/features/staff/queries.ts`** — `useQuery` / `useMutation` フックはすべてここ。`useStaffIdentity()` がセッションとスタッフコンテキストを `{ userId, tenantId, storeId }` にまとめる。クエリは `enabled: Boolean(userId && tenantId)` を付け、それを根拠に `queryFn` 内で非null断言を使う。queryKeyには必ずuserId/tenantId/storeIdを含めるため、テナントや店舗を切り替えると再取得される。mutationはキーのprefix単位でinvalidateする。
3. **画面** — フックのみを使う。画面から `api.ts` を直接呼ばない。

データ操作を追加するときは、この順に3層すべてへ手を入れる。

### Supabase と RPC

`src/lib/supabase.ts` は `supabase` を `SupabaseClient | null` としてエクスポートする。必ずnullチェックするか `api.ts` 経由で使う。`detectSessionInUrl` は無効。セッションは `authStorage` で永続化する。

`src/lib/auth-storage.ts` は分割保存版SecureStore（1800バイトずつのチャンク＋`.chunks` 件数キー）を実装している。SupabaseのJWTがSecureStoreの上限を超えるため。旧AsyncStorage値からの一度きりの移行処理も含む。Webでは AsyncStorage にフォールバックする。

`api.ts` から呼ぶRPC:
- `record_mobile_attendance_event`、`submit_mobile_manual_attendance` — このリポジトリの `supabase/migrations/` に定義。`authenticated` 限定（`anon` からexecuteを剥奪済み）。
- `replace_shift_request_entries`、`submit_mobile_shift_adjustment` — **Web版リポジトリ**のスキーマ側が正本。ここのmigrationには存在しない。

権限昇格が必要な処理はクライアントではなくRPCかEdge Functionへ寄せる。アプリに載せるのはpublishable keyのみ。

### UIの決まり

`src/constants/app-theme.ts` がデザイントークンの正本。`useAppTheme()` がライト/ダークのパレットを返し、`appSpacing` と `appRadii` も併せて提供する。スタイルはテーマを参照するインラインオブジェクトで書く。StyleSheetや `Colors` のような中間層は使わない。

画面は `src/components/ui/` を組み合わせて作る: `AppScreen`（ScrollView＋RefreshControl＋safe inset）、`SectionCard`、`SectionHeading`、`PageIntro`、`ListRow`、`StatusPill`、`NativeActionButton`、および `data-state.tsx` の `LoadingState` / `ErrorState` / `EmptyState`。

**業務画面にデモデータを出さない。** `src/features/staff/demo-data.ts` は存在するがどこからも参照されていない。設定不足・所属なし・取得失敗を明示する状態表示を使うこと。

`@expo/ui`（SwiftUI / Jetpack Compose）のプリミティブを優先し、確定操作には `expo-haptics` を付ける。OS権限はその機能を使う直前に要求する。

## コーディングスタイル

TypeScript strict、2スペースインデント、シングルクォート、セミコロンあり。ファイル名はkebab-case（`staff-provider.tsx`）、コンポーネントと型は`PascalCase`、関数は`camelCase`、フックは`use`始まり。importは深い相対パスではなく `@/*`（→ `src/*`）と `@/assets/*` を使う。`app.json` で `typedRoutes` と React Compiler が有効。

Expo APIを変更する前に [Expo SDK 57のドキュメント](https://docs.expo.dev/versions/v57.0.0/) を正確に読む。ここで使っているAPIの一部（NativeTabs、`expo-glass-effect`）はSDK 57で新規またはunstable。

## 進捗ドキュメント

更新され続ける3つのドキュメント。スコープが動いたら合わせて更新する。
- `migration-progress.md` — Web→Nativeのスタッフ業務対応表と実装順。
- `docs/implementation-status.md` — 機能別の完了 / 一部実装 / 未実装の判定と既知の制約。
- `docs/native-implementation-plan.md` — フェーズ計画と初回リリース範囲。

既知の未対応: 店舗全体の公開シフト表と画像保存・共有、公開後のシフト調整申請、勤怠履歴の既存レコード修正、Push配信（EAS Project IDとAPNs/FCM credentials、サーバー側送信処理が必要）。

## セキュリティ

`service_role`、Secret Key、メール/SMTP、Stripe、Expo Access Tokenを `EXPO_PUBLIC_*` に入れない。これらは配布バイナリへ埋め込まれる。サーバー専用の値は `supabase/.env.example` に分離して記載する。全テーブルでRLSを維持し、RPCは `authenticated` 限定を保ち、本番スキーマ変更は必ずタイムスタンプ付きmigrationとして記録する。
