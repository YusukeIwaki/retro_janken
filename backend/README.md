# retro_janken backend

FastAPI で JPEG/PNG の手画像を受け取り、MediaPipe の手ランドマークからグー・チョキ・パーを判定します。画像内に手がなければ `hand: null` を返すため、顔や背景をグーとして扱いません。

## セットアップと起動

Python 3.12 と [uv](https://docs.astral.sh/uv/) を使用します。

```sh
uv sync
uv run python scripts/download_models.py
uv run uvicorn rps.main:app --reload --port 8000
```

`download_models.py` は Google 公式の `hand_landmarker.task` を `models/` に保存します。このモデルファイルはリポジトリには含めません。通常の `uv sync` は MediaPipe、API、テストに必要な依存だけを導入し、TensorFlow は導入しません。フロントエンド開発サーバー `http://localhost:5173` からの CORS アクセスを許可しています。

判定器の自動選択順は `landmark` → `cnn` → `stub` です。`models/hand_landmarker.task` があればランドマーク判定器を使い、なければ `models/rps_cnn.keras`、それも利用できなければ画像内容の SHA-256 に基づく決定的な stub 判定器へフォールバックします。MediaPipe の landmarker は最初の判定時に遅延初期化されます。

`RPS_CLASSIFIER` で開始する判定器を明示できます。

```sh
RPS_CLASSIFIER=landmark uv run uvicorn rps.main:app --reload --port 8000
RPS_CLASSIFIER=cnn uv run uvicorn rps.main:app --reload --port 8000
RPS_CLASSIFIER=stub uv run uvicorn rps.main:app --reload --port 8000
```

`landmark` 指定時にランドマークモデルがなければ CNN、`cnn` 指定時に CNN モデルまたは TensorFlow がなければ stub へフォールバックします。

## テスト

テストは stub またはフェイク判定器を注入するため、ランドマークの実モデルと TensorFlow を必要としません。

```sh
uv sync
uv run pytest
```

## CNN の学習

TensorFlow と TensorFlow Datasets は `ml` dependency group にだけ含まれます。

```sh
uv sync --group ml
uv run --group ml python training/train.py
```

`tensorflow_datasets` の `rock_paper_scissors` を使い、MobileNetV2 をベース凍結で学習した後、上位層を fine-tune します。学習済みモデルは `models/rps_cnn.keras` に保存されます。データセットは白背景の CGI 画像が中心で実カメラ画像への汎化には限界があるため、精度を上げる場合は実際の利用環境で収集した自前データを追加して fine-tune してください。
