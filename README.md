# retro_janken

昔ながらのじゃんけんマシーン「ジャンケンマン」を Web で再現。
カメラに映したグー/チョキ/パーを CNN(バックエンド API)で判定し、
ドット絵 + レトロ音声の演出で勝負する。

- 設計: [docs/DESIGN.md](docs/DESIGN.md)
- フロントエンド詳細: [frontend/README.md](frontend/README.md)
- バックエンド詳細: [backend/README.md](backend/README.md)

## クイックスタート

```sh
# 1. バックエンド (port 8000) — モデル未学習時は stub 判定器で動く
cd backend
uv sync
uv run uvicorn rps.main:app --port 8000

# 2. フロントエンド (port 5173, /api を 8000 にプロキシ)
cd frontend
npm install
./scripts/generate-voice.sh   # プレースホルダ音声 (macOS の say を使用)
npm run dev
```

ブラウザで http://localhost:5173 を開き、カメラを許可してスタート。

## CNN モデルの学習

```sh
cd backend
uv sync --group ml
uv run --group ml python training/train.py   # rock_paper_scissors データセットで転移学習
```

学習後は `backend/models/rps_cnn.keras` が自動でロードされる
(`GET /api/health` の `classifier` が `cnn` になる)。
データセットは白背景 CGI のため実カメラへの汎化は限定的。精度を上げたい場合は自前データで fine-tune すること。

## テスト

```sh
cd frontend && npm test -- --run        # vitest (ロジック単体)
cd frontend && npm run playwright:install && npm run test:ct   # Playwright CT (コンポーネント)
cd backend && uv run pytest              # API テスト (TensorFlow 不要)
```

## 音声の差し替え

`frontend/public/audio/{janken,pon,aiko,win,lose}.wav` を同名で置き換えるだけで
生成 AI 音声に差し替えられる(ファイル名が契約)。
