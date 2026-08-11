# retro_janken 設計書

昔ながらのじゃんけんマシーン「ジャンケンマン」を Web で再現する。
レトロなドット絵 + 音声演出のフロントエンドと、カメラ画像からグー/チョキ/パーを
CNN で判定する Python バックエンドで構成するモノレポ。

## 全体構成

```
retro_janken/
├── frontend/   # Vite + React + TypeScript (レトロ UI, カメラ, 音声)
├── backend/    # Python (FastAPI) 画像判定 API + CNN 学習スクリプト
└── docs/       # 設計文書
```

- 開発時: frontend dev server (port 5173) が `/api/*` を backend (port 8000) にプロキシ。
- 本番想定: backend が静的ビルド成果物を配信してもよいが、本リポジトリでは開発体験を優先。

## ゲーム仕様(ジャンケンマン再現)

状態機械として定義する。**このロジックは純粋 TypeScript として実装し、単体テストで固める。**

```
idle ──(スタート)──> calling ──(掛け声完了)──> capturing ──(判定結果)──> judging
                        ^                                                  │
                        │                                                  ├─ draw ──> aiko ─┐
                        │                                                  │   (あいこでしょ!)│
                        │                                                  │      └──────────┘→ capturing に戻る
                        └────────────(結果表示完了)── result <─ win/lose ──┘
                                                        │
                                                        └──> idle
```

- `calling`: 「ジャンケン…ポン!」の音声 + マシンの手が高速で切り替わるドット絵アニメーション。
- `capturing`: 「ポン!」のタイミングでカメラフレームを 1 枚キャプチャし `/api/classify` に POST。
  マシン側の手は乱数で決定(`Math.random` 直接ではなく注入可能な RNG インターフェース経由)。
- `judging`: ユーザーの手(API 結果)とマシンの手で勝敗判定。
  - 勝ち: 「かった!」ジングル + メダル加算演出
  - 負け: 「まけた!」ジングル
  - あいこ: 「あいこでしょ!」音声 → 再キャプチャ(`aiko` 経由で `capturing` へループ)
- API エラー / 低信頼度 (confidence < 0.6) の場合は「もういっかい!」で `calling` からやり直し。
- スコア: 勝ち数をメダルとして LocalStorage に永続化。

## フロントエンド

### 技術スタック

- Vite + React 18 + TypeScript (strict)
- 単体テスト: **vitest** (jsdom) — ロジック層を網羅
- コンポーネントテスト: **Playwright Component Testing** (`@playwright/experimental-ct-react`) — 描画・インタラクション
- 実ブラウザでの手動確認は最終スモークのみ、が成り立つテスト構成にする

### モジュール分割(テスタビリティが最優先)

副作用を持つものはすべて interface 化し、DI でゲームエンジンに注入する。

| モジュール | 責務 | テスト |
|---|---|---|
| `src/game/judge.ts` | 手の型 `Hand = 'rock'\|'scissors'\|'paper'`、勝敗判定の純関数 | vitest |
| `src/game/engine.ts` | 状態機械 (reducer + 副作用オーケストレーション)。`Camera`/`Classifier`/`SoundPlayer`/`Rng`/`Clock` を注入 | vitest (全依存モック) |
| `src/adapters/camera.ts` | `getUserMedia` + canvas キャプチャ → JPEG Blob。`Camera` interface 実装 | CT でフェイク、単体は薄いので最小 |
| `src/adapters/classifierApi.ts` | `/api/classify` クライアント。`Classifier` interface 実装 | vitest (fetch モック) |
| `src/adapters/sound.ts` | 音声再生。ボイス = `public/audio/*.wav`、ジングル = Web Audio 合成。`SoundPlayer` interface 実装 | vitest (AudioContext モック) |
| `src/components/HandSprite.tsx` | グー/チョキ/パーのドット絵 (インライン SVG or CSS ピクセルアート) | Playwright CT |
| `src/components/MachinePanel.tsx` | マシン筐体・LED 風表示・メダルカウンタ | Playwright CT |
| `src/components/GameScreen.tsx` | 全体画面。engine の状態を描画。カメラプレビュー付き | Playwright CT (依存すべてフェイク注入) |

### レトロ演出

- ドット絵: 16x16 グリッド程度のピクセルアートをコード内データ (2次元配列 or SVG) で表現。
  外部画像アセットに依存しない(テスト・ビルドを単純に保つ)。
- 配色: 黄色い筐体 + 赤 LED 風 7 セグ調フォント。CSS のみで CRT 風スキャンラインを表現。
- 音声ファイル: `frontend/public/audio/` に `janken.wav` `pon.wav` `aiko.wav` `win.wav` `lose.wav` を配置。
  **プレースホルダは macOS `say` コマンドで生成するスクリプト** `frontend/scripts/generate-voice.sh` を用意し、
  後から生成 AI 音声に差し替え可能にする(ファイル名契約のみ固定)。
  音声ファイルが無くてもゲームは動作すること(再生失敗は握りつぶしてゲーム進行を止めない)。

### カメラ

- `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })`
- キャプチャ: video → canvas 224x224 中央クロップ → `canvas.toBlob('image/jpeg', 0.8)`
- カメラ不許可時はエラーメッセージ表示のみ(ゲーム開始不可)。

## バックエンド

### 技術スタック

- Python 3.12 (uv 管理; `backend/pyproject.toml` + `uv.lock`, `requires-python = ">=3.12,<3.13"`)
- FastAPI + uvicorn
- TensorFlow / Keras (CNN 推論・学習)
- テスト: pytest + httpx (FastAPI TestClient)

### API 契約

```
POST /api/classify
  Content-Type: multipart/form-data; フィールド名 "image" (JPEG/PNG)
  200 → { "hand": "rock" | "scissors" | "paper" | null, "confidence": 0.0-1.0, "latency_ms": number }
        hand が null のときは「画像内に手が検出できなかった」ことを表す (confidence は 0.0)
  400 → { "detail": "..." }  (画像がデコード不能など)
GET /api/health
  200 → { "status": "ok", "classifier": "landmark" | "cnn" | "stub" }
```

- CORS: `http://localhost:5173` を許可(開発用)。

### 判定器の抽象化

```python
class Classifier(Protocol):
    name: str
    def classify(self, image: PIL.Image.Image) -> tuple[Hand | None, float]: ...
```

判定器は 3 種類。優先順位は landmark → cnn → stub(`RPS_CLASSIFIER` 環境変数で明示指定も可)。

- **`LandmarkClassifier`(既定)**: MediaPipe Hands で手の 21 ランドマークを検出し、
  指の伸展状態からグー/チョキ/パーを幾何学的に判定する。
  - 手が検出できない画像(顔だけ・背景だけ)は `(None, 0.0)` を返す。
    **「顔をグーと誤判定する」問題を構造的に排除するのがこの方式の核心。**
  - 2 段構成に分離し、幾何判定を純関数としてテスト可能にする:
    - `HandLandmarkDetector`(mediapipe ラッパー、`hand_landmarker.task` モデルを使用)
    - `rps/landmark_logic.py` の `classify_from_landmarks(landmarks) -> tuple[Hand | None, float]`
      (純関数。指ごとの伸展判定 → 伸びている指の組合せで手を決定。
      グー=0〜1本、チョキ=人差し指+中指、パー=4本以上。曖昧なら低 confidence)
  - モデルファイル `backend/models/hand_landmarker.task` は
    `backend/scripts/download_models.py` でダウンロード(Google 公式 URL、リポジトリには含めない)。
  - mediapipe は default dependencies に含める(推論に TF 学習環境は不要)。
- `CnnClassifier`(レガシー・任意): `backend/models/rps_cnn.keras` があり
  `RPS_CLASSIFIER=cnn` のときのみ使用。CGI データセット学習のため実カメラ精度は低い。
- `StubClassifier`: 上記が使えない場合・`RPS_CLASSIFIER=stub` の場合のフォールバック。
  画像バイト列のハッシュから決定的に手を返す(テストの再現性のため)。
- **API のテストは stub またはフェイク判定器で実行し、
  ランドマークモデルファイル・TensorFlow 無しで pytest が通ること**
  (TF は optional dependency group `[ml]` に分離)。
  `classify_from_landmarks` は合成ランドマーク座標で純関数として網羅テストする。

### フロントエンドの対応

- `classifierApi.ts`: レスポンス `hand: null` を `NoHandError`(「わくの中に手を出してね」)として
  throw する。engine の既存エラーリトライ経路(「もういっかい！」)に乗るため engine 変更は不要。

### CNN 学習 (`backend/training/train.py`) — レガシー

- データセット: `tensorflow_datasets` の `rock_paper_scissors` (TF 公式, CGI 手画像 2,892 枚)
- モデル: MobileNetV2 (ImageNet 重み, include_top=False) + GlobalAveragePooling + Dropout + Dense(3)
  - 入力 224x224、転移学習(ベース凍結 → 数 epoch 後に上位層 fine-tune)
- 前処理・拡張: ランダム反転・回転・ズーム・明度。**推論側と同一の前処理関数を
  `backend/rps/preprocess.py` に共通化**し、学習/推論の不一致を防ぐ。
- 出力: `backend/models/rps_cnn.keras` + 検証精度をログ出力
- 注意: このデータセットは白背景 CGI のため実カメラへの汎化は限定的。
  README に「精度を上げたい場合は自前データで fine-tune」と明記する。

## テスト戦略まとめ

| レイヤ | ツール | 対象 |
|---|---|---|
| frontend ロジック | vitest | judge / engine (状態遷移・あいこループ・エラー再試行) / API client / sound sequencer |
| frontend コンポーネント | Playwright CT (chromium) | 各コンポーネントの描画、GameScreen のフェイク依存での一連プレイ |
| backend | pytest | /api/classify (stub), /api/health, 前処理, 画像バリデーション |
| 手動 | ブラウザ | カメラ実機 + CNN 判定の最終スモークのみ |

## 非スコープ

- 認証・マルチプレイ・デプロイ設定
- 実カメラ画像での高精度化(データセット収集)は将来課題
