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
  say -v Kyoko -r 190 -o "$voice_temp_dir/$name.aiff" "$phrase"
  afconvert -f WAVE -d LEI16@22050 "$voice_temp_dir/$name.aiff" "$output_dir/$name.wav"
}

generate_voice janken "じゃんけん"
generate_voice pon "ぽん"
generate_voice aiko "あいこでしょ"
generate_voice win "かった"
generate_voice lose "まけた"

echo "Generated placeholder WAV files in $output_dir"
