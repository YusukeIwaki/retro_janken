# retro_janken backend

FastAPI で JPEG/PNG の手画像を受け取り、グー・チョキ・パーを判定します。学習済みモデルがない通常の開発環境では、画像内容の SHA-256 に基づく決定的な stub 判定器を使います。

## セットアップと起動

Python 3.12 と [uv](https://docs.astral.sh/uv/) を使用します。

```sh
uv sync
uv run uvicorn rps.main:app --reload --port 8000
```

通常の `uv sync` は API とテストに必要な依存だけを導入し、TensorFlow は導入しません。フロントエンド開発サーバー `http://localhost:5173` からの CORS アクセスを許可しています。

モデルが `models/rps_cnn.keras` にあれば起動時にロードしてウォームアップ推論します。モデルがない場合、または `RPS_CLASSIFIER=stub` を指定した場合は stub にフォールバックします。

```sh
RPS_CLASSIFIER=stub uv run uvicorn rps.main:app --reload --port 8000
```

## テスト

テストは stub を注入するため TensorFlow を必要としません。

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
