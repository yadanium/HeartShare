# HeartShare

HeartShareは、Fitbit Inspire 3の心拍数をFitbitアプリからHealth Connectへ同期し、Androidアプリで最新の心拍数を読み取ってFirebase Realtime Databaseへ送信するアプリです。恋人や家族はWebページのURLを開くだけで、リアルタイムの心拍数を見られます。

## 構成

```text
Fitbit Inspire 3
↓
Fitbitアプリ
↓
Health Connect
↓
Androidアプリ Kotlin / Compose / Foreground Service
↓
Firebase Realtime Database
↓
Web PWA HTML / CSS / JavaScript
```

## ディレクトリ

```text
HeartShare/
├─ app/        Androidアプリ
├─ web/        GitHub Pagesで公開するWeb/PWA
├─ firebase/   Realtime Database Rules
└─ README.md
```

## Androidアプリ

### 主な実装

- Kotlin
- Jetpack Compose
- MVVM構成
- Health Connect接続
- Health Connect心拍数読み取り権限管理
- Foreground Service
- 5秒ごとの最新心拍数取得
- Firebase Realtime Database送信
- Coroutineによる非同期処理
- 例外処理とLogcat出力
- Material3 UI

### 必要なもの

- Android Studio最新版
- JDK 17
- Health Connect対応端末、またはHealth ConnectをインストールしたAndroid端末
- Fitbitアプリ
- Fitbit Inspire 3
- Firebaseプロジェクト

最低SDKは26、compileSdk / targetSdkは35です。

## Firebase作成方法

1. [Firebase Console](https://console.firebase.google.com/)を開きます。
2. 新しいプロジェクトを作成します。
3. Realtime Databaseを作成します。
4. ロケーションを選択します。
5. 最初はテストモードで作成して構いません。
6. 作成後、`firebase/database.rules.json` の内容をRealtime DatabaseのRulesへ貼り付けて公開します。

保存形式はルート直下に次の3項目です。

```json
{
  "heartRate": 78,
  "timestamp": 1730000000000,
  "online": true
}
```

現在のRulesは、URLを知っている人が閲覧でき、Androidアプリから未認証で3項目のみを書き込める構成です。URLを完全に公開するサービスにする場合は、Firebase AuthenticationまたはApp Checkを追加してください。

## AndroidアプリをFirebaseへ接続する

1. Firebase Consoleでプロジェクトを開きます。
2. Androidアプリを追加します。
3. Androidパッケージ名に次を入力します。

```text
com.heartshare.app
```

4. デバッグ実行するPCでSHA-1を確認します。

Windows PowerShell:

```powershell
keytool -list -v -alias androiddebugkey -keystore "$env:USERPROFILE\.android\debug.keystore" -storepass android -keypass android
```

5. FirebaseのAndroidアプリ設定にSHA-1を登録します。
6. `google-services.json` をダウンロードします。
7. ダウンロードしたファイルで `app/google-services.json` を置き換えます。

このリポジトリにはビルド構成を成立させるためのプレースホルダー `google-services.json` を入れています。実際のRealtime Databaseへ送信するには必ずFirebase Consoleから取得したファイルに差し替えてください。

## WebをFirebaseへ接続する

Firebase ConsoleでWebアプリを追加し、表示されたFirebase設定を `web/script.js` の `firebaseConfig` に貼り付けます。

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

`databaseURL` はRealtime DatabaseのURLと一致している必要があります。

Android側も `app/build.gradle.kts` の `FIREBASE_DATABASE_URL` に同じURLを設定しています。Realtime Databaseを作成した地域によってURLが異なる場合は、Firebase ConsoleのRealtime Database画面に表示されるURLへ変更してください。

## Health Connect設定

1. Android端末にFitbitアプリをインストールします。
2. FitbitアプリでFitbit Inspire 3をセットアップします。
3. FitbitアプリのHealth Connect連携を有効にします。
4. Health Connect側でFitbitから心拍数データの書き込みを許可します。
5. HeartShareアプリを起動します。
6. `Health Connectを許可` を押します。
7. 心拍数の読み取りを許可します。
8. `共有を開始` を押します。

Foreground Serviceが起動し、5秒ごとに直近24時間の心拍数サンプルから最新値を選んでFirebaseへ送信します。

## Android Studioで実行する

1. Android Studioでこのリポジトリを開きます。
2. Gradle同期を実行します。
3. `app/google-services.json` が実Firebaseのものに差し替わっていることを確認します。
4. 実機を接続します。
5. `app` 構成でRunします。
6. 通知権限とHealth Connect権限を許可します。
7. アプリ画面で共有を開始します。

Logcatでは次のタグを確認できます。

```text
HealthRepository
FirebaseRepository
HeartRateService
MainViewModel
```

## Webアプリ

`web/index.html` はHTML/CSS/JavaScriptのみで動作します。ReactやVue、ビルドツールは使っていません。

主な機能:

- Firebase Realtime Databaseの購読
- 心拍数の滑らかな数値更新
- 心拍数に同期した鼓動アニメーション
- 60bpmなら1秒周期、120bpmなら0.5秒周期
- Glow / Brightness / Shadow / scaleを組み合わせた自然な鼓動
- `LIVE`、`Waiting...`、`Offline` 表示
- `たった今`、`〇秒前`、`〇分前` の最終更新表示
- PWA manifest
- Service Worker
- ホーム画面追加対応
- PC、iPhone、Android、iPad対応

ローカル確認は `web/index.html` をブラウザで開きます。Firebase SDKはCDNから読み込むため、インターネット接続が必要です。

## GitHub Pages公開方法

1. GitHubでリポジトリを開きます。
2. `Settings` を開きます。
3. `Pages` を開きます。
4. `Build and deployment` のSourceで `GitHub Actions` を選びます。
5. `main` にpushすると `.github/workflows/pages.yml` が `web/` を自動公開します。
6. 数分後、表示されたURLを開きます。

公開前に必ず `web/script.js` のFirebase設定を実プロジェクトの値に差し替えてください。

## Firebase Rulesの反映

Firebase CLIを使う場合:

1. `.firebaserc.example` を `.firebaserc` にコピーします。
2. `your-firebase-project-id` を自分のFirebaseプロジェクトIDに置き換えます。
3. Firebase CLIでログインします。

```bash
firebase login
```

4. Realtime Database Rulesをデプロイします。

```bash
firebase deploy --only database
```

`firebase.json` はこのリポジトリに含まれているため、RulesとHostingのデプロイ先は設定済みです。

手動で反映する場合:

1. Firebase Consoleを開きます。
2. Realtime Databaseを開きます。
3. Rulesタブを開きます。
4. `firebase/database.rules.json` の中身を貼り付けます。
5. Publishします。

## 注意点

- FitbitからHealth Connectへの同期タイミングはFitbitアプリ側に依存します。
- Androidアプリは5秒ごとにHealth Connectを読みますが、Fitbit側の同期が遅い場合は同じ心拍数が続くことがあります。
- Web側は20秒以上更新がない場合にOffline表示へ切り替えます。
- 実運用で不特定多数にURLを公開する場合は、Firebase AuthenticationまたはApp Checkを追加してください。
- Android Gradle Pluginはビルド確認済みの `8.7.3` に固定しています。Android Studioが更新を勧めても、まずはこのまま動作確認してください。
