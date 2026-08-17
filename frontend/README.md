# Retro Janken frontend

React 18 + TypeScript で実装した、カメラ判定式のレトロじゃんけん画面です。開発サーバーは `/api` を `http://localhost:8000` へプロキシします。

## セットアップと起動

Node.js 20.19 以降（または 22.12 以降）を使用してください。

```sh
npm install
npm run dev
```

バックエンドを port 8000 で起動し、ブラウザで `http://localhost:5173` を開いてカメラ使用を許可します。カメラを許可できない場合はエラーを表示し、ゲーム開始ボタンは無効になります。

## テストとビルド

Vitest の単体テストと本番ビルド:

```sh
npm test -- --run
npm run build
```

Playwright Component Testing は、最初に Chromium をインストールする必要があります。CI 相当の実行手順は次のとおりです。

```sh
npm run playwright:install
npm run test:ct
```

`playwright:install` は `npx playwright install chromium` と同じ処理を行い、ブラウザをプロジェクト内の無視対象ディレクトリへ保存します。すでに通常の Playwright キャッシュへ導入済みの場合も、上記の CI 相当手順をそのまま利用できます。

## プレースホルダ音声

ゲームは音声ファイルが存在しなくても進行します。macOS では `say` と `afconvert` を使い、契約済みのファイル名でプレースホルダ WAV を生成できます。掛け声は「じゃーん、けん」「ぽーん！」と間を取った、16 kHz mono のローファイなアーケード調です。

```sh
./scripts/generate-voice.sh
```

生成先は `public/audio/`、ファイル名は `janken.wav`、`pon.wav`、`aiko.wav`、`win.wav`、`lose.wav` です。WAV は生成物なのでリポジトリには含めず、必要に応じて差し替えてください。勝利時は Web Audio で減速するルーレット音と着地ジングルも重ねます。

## 構成

- `src/game/`: 副作用を持たない勝敗判定、reducer、状態機械オーケストレーション
- `src/adapters/`: カメラ、判定 API、音声、時刻・乱数、LocalStorage のブラウザ実装
- `src/components/`: コード内ピクセルデータの手、黄色い筐体、カメラ付きゲーム画面

メダル数は LocalStorage の `retro-janken-medals` に保存されます。
