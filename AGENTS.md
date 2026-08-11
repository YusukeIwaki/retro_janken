# AGENTS.md — 実装エージェント向け規約

このリポジトリの設計は `docs/DESIGN.md` に定義されている。**必ず読んでから作業すること。**
設計と矛盾する実装をしない。判断に迷ったらテスタビリティを優先する。

## 共通

- モノレポ: `frontend/`(Vite + React + TS)と `backend/`(Python + FastAPI)。互いのディレクトリに依存を持ち込まない。
- コミットは作らない(検収者が行う)。
- 外部バイナリアセット(画像・音声)をリポジトリに追加しない。音声はスクリプト生成、ドット絵はコード内データで表現。

## frontend

- TypeScript strict。`any` 禁止。
- 副作用(カメラ・fetch・音声・乱数・時刻)は必ず interface 経由で注入する。`src/game/` 配下は純粋ロジックのみ。
- テスト: vitest(ロジック)+ `@playwright/experimental-ct-react`(コンポーネント)。
  - `npm test` で vitest、`npm run test:ct` で Playwright CT が動くこと。
  - engine の状態遷移(あいこループ、低信頼度リトライ、API エラー)は網羅的にテストする。
- Playwright ブラウザは `npx playwright install chromium` 済みでない可能性がある。install コマンドは README に書き、CI 相当の手順を `npm run test:ct` の前提として明記。

## backend

- uv 管理。`uv run pytest` が TensorFlow 無しで通ること(TF は `[ml]` dependency group に分離)。
- 型ヒント必須。FastAPI のレスポンスは Pydantic モデルで定義。
- `StubClassifier` は画像バイトのハッシュで決定的に手を返す(乱数禁止)。

## 検収コマンド(これが全部通る状態で完了とする)

```
cd frontend && npm ci && npm test -- --run && npm run build
cd backend && uv sync && uv run pytest
```
