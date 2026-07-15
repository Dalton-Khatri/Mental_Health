import os
import numpy as np
import pandas as pd
import librosa
import soundfile as sf
from tqdm import tqdm

# ----------------------------
# Paths
# ----------------------------
DATASET_PATH = r"D:\Mental_health\extended daic-woz"

OUTPUT_AUDIO = "D:/Mental_health/processed/audio"
OUTPUT_TEXT = "D:/Mental_health/processed/transcript"

os.makedirs(OUTPUT_AUDIO, exist_ok=True)
os.makedirs(OUTPUT_TEXT, exist_ok=True)

TARGET_SR = 16000


# ---------------------------------------------------------
# Load transcript (comma-delimited, participant-only already)
# ---------------------------------------------------------
def load_transcript(csv_path):
    df = pd.read_csv(csv_path, sep=",")
    df.columns = [c.strip().lower() for c in df.columns]

    required = {"start_time", "end_time", "text"}
    if not required.issubset(set(df.columns)):
        print(f"Skipping {csv_path} - missing columns: {required - set(df.columns)}")
        return None

    return df


# ---------------------------------------------------------
# Clean transcript while keeping pauses
# ---------------------------------------------------------
def clean_transcript(csv_path):
    df = load_transcript(csv_path)
    if df is None:
        return ""

    sentences = []
    previous_stop = None

    for _, row in df.iterrows():
        start = float(row["start_time"])
        stop = float(row["end_time"])
        text = str(row["text"]).strip()

        if text == "" or text.lower() == "nan":
            continue

        if previous_stop is not None:
            pause = start - previous_stop
            if pause >= 2:
                sentences.append("[LONG_PAUSE]")
            elif pause >= 1:
                sentences.append("[PAUSE]")

        sentences.append(text)
        previous_stop = stop

    return " ".join(sentences)


# ---------------------------------------------------------
# Cut participant audio using transcript timestamps
# (file is already participant-only, so this just trims
# out silence/other segments not covered by the transcript)
# ---------------------------------------------------------
def extract_participant_audio(csv_path, audio, sr):
    df = load_transcript(csv_path)
    if df is None:
        return None

    segments = []

    for _, row in df.iterrows():
        start = float(row["start_time"])
        stop = float(row["end_time"])

        if (stop - start) < 0.3:
            continue

        start_sample = int(start * sr)
        end_sample = min(int(stop * sr), len(audio))

        if start_sample < end_sample:
            segments.append(audio[start_sample:end_sample])

    if not segments:
        return None

    return np.concatenate(segments)


# ---------------------------------------------------------
# Process one participant
# ---------------------------------------------------------
def process_participant(folder):
    participant_id = folder.replace("_P", "")

    base_path = os.path.join(DATASET_PATH, folder, folder)

    audio_path = os.path.join(base_path, f"{participant_id}_AUDIO.wav")
    transcript_path = os.path.join(base_path, f"{participant_id}_TRANSCRIPT.csv")

    if not os.path.exists(audio_path):
        print(f"Missing audio for {participant_id}, skipping.")
        return

    if not os.path.exists(transcript_path):
        print(f"Missing transcript for {participant_id}, skipping.")
        return

    audio, sr = librosa.load(audio_path, sr=TARGET_SR, mono=True)

    clean_audio = extract_participant_audio(transcript_path, audio, sr)

    if clean_audio is None:
        print(f"No valid participant audio for {participant_id}, skipping.")
        return

    sf.write(
        os.path.join(OUTPUT_AUDIO, f"{participant_id}.wav"),
        clean_audio,
        TARGET_SR,
    )

    text = clean_transcript(transcript_path)

    with open(
        os.path.join(OUTPUT_TEXT, f"{participant_id}.txt"),
        "w",
        encoding="utf8",
    ) as f:
        f.write(text)


# ---------------------------------------------------------
# Process whole dataset
# ---------------------------------------------------------
folders = sorted(os.listdir(DATASET_PATH))

for folder in tqdm(folders):
    if folder.endswith("_P"):
        process_participant(folder)

print("Finished!")