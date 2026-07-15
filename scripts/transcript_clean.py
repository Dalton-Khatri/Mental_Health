import os
import re

TRANSCRIPT_DIR = "D:/Mental_health/processed/transcript"
OUTPUT_DIR = "D:/Mental_health/processed/transcript_clean"

os.makedirs(OUTPUT_DIR, exist_ok=True)

for fname in os.listdir(TRANSCRIPT_DIR):
    if not fname.endswith(".txt"):
        continue

    path = os.path.join(TRANSCRIPT_DIR, fname)

    with open(path, "r", encoding="utf8") as f:
        text = f.read()

    # remove the pause tags
    text = text.replace("[LONG_PAUSE]", "")
    text = text.replace("[PAUSE]", "")

    # collapse extra whitespace left behind
    text = re.sub(r"\s+", " ", text).strip()

    out_path = os.path.join(OUTPUT_DIR, fname)
    with open(out_path, "w", encoding="utf8") as f:
        f.write(text)

print("Done.")