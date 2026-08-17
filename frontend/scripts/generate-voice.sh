#!/bin/sh
set -eu

if ! command -v say >/dev/null 2>&1 || ! command -v afconvert >/dev/null 2>&1; then
  echo "This script requires macOS 'say' and 'afconvert'." >&2
  exit 1
fi

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
output_dir="$script_dir/../public/audio"
voice_temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/retro-janken-voice.XXXXXX")

cleanup() {
  rm -f "$voice_temp_dir/janken.aiff" "$voice_temp_dir/pon.aiff" \
    "$voice_temp_dir/aiko.aiff" "$voice_temp_dir/win.aiff" \
    "$voice_temp_dir/lose.aiff"
  rmdir "$voice_temp_dir"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$output_dir"

generate_voice() {
  name=$1
  phrase=$2
  rate=$3
  say -v Kyoko -r "$rate" -o "$voice_temp_dir/$name.aiff" "$phrase"
  # 16 kHz mono keeps the deliberately narrow, slightly mechanical arcade tone.
  afconvert -f WAVE -d LEI16@16000 -c 1 \
    "$voice_temp_dir/$name.aiff" "$output_dir/$name.wav"
}

generate_voice janken "じゃーん、けん" 160
generate_voice pon "ぽーん！" 150
generate_voice aiko "あーいこで、しょ！" 170
generate_voice win "かったあ！" 170
generate_voice lose "まけちゃった" 175

echo "Generated placeholder WAV files in $output_dir"
