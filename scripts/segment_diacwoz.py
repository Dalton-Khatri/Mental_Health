import os
import numpy as np
import pandas as pd
import librosa
import soundfile as sf
from tqdm import tqdm

# ----------------------------
# Paths
# ----------------------------
DATASET_PATH = "D:/daic_woz_processing"

OUTPUT_AUDIO = "processed/audio"
OUTPUT_TEXT = "processed/transcript"

os.makedirs(OUTPUT_AUDIO, exist_ok=True)
os.makedirs(OUTPUT_TEXT, exist_ok=True)

TARGET_SR = 16000


# ---------------------------------------------------------
# Clean transcript while keeping participant pauses
# ---------------------------------------------------------
def clean_transcript(csv_path):

    df = pd.read_csv(csv_path, sep="\t")

    participant_rows = df[df["speaker"] == "Participant"]

    sentences = []
    previous_stop = None

    for _, row in participant_rows.iterrows():

        start = float(row["start_time"])
        stop = float(row["stop_time"])
        text = str(row["value"]).strip()

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
# Cut participant-only audio using transcript timestamps
# This is the fix -- we use the same participant rows
# to slice out only their speech from the full recording
# ---------------------------------------------------------
def extract_participant_audio(csv_path, audio, sr):

    df = pd.read_csv(csv_path, sep="\t")

    participant_rows = df[df["speaker"] == "Participant"]

    segments = []

    for _, row in participant_rows.iterrows():

        start = float(row["start_time"])
        stop = float(row["stop_time"])

        # skip near-empty turns (annotation noise)
        if (stop - start) < 0.3:
            continue

        start_sample = int(start * sr)
        end_sample = int(stop * sr)

        # clamp to actual audio length just in case
        end_sample = min(end_sample, len(audio))

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

    audio_path = os.path.join(
        DATASET_PATH,
        folder,
        f"{participant_id}_AUDIO.wav",
    )

    transcript_path = os.path.join(
        DATASET_PATH,
        folder,
        f"{participant_id}_TRANSCRIPT.csv",
    )

    if not os.path.exists(audio_path):
        return

    if not os.path.exists(transcript_path):
        return

    # ------------------------
    # Load full session audio
    # ------------------------
    audio, sr = librosa.load(
        audio_path,
        sr=TARGET_SR,
        mono=True,
    )

    # ------------------------
    # Cut to participant turns only (removes Ellie's voice)
    # ------------------------
    clean_audio = extract_participant_audio(transcript_path, audio, sr)

    if clean_audio is None:
        return

    # Save audio (no normalization)
    sf.write(
        os.path.join(
            OUTPUT_AUDIO,
            f"{participant_id}.wav",
        ),
        clean_audio,
        TARGET_SR,
    )

    # ------------------------
    # Save transcript
    # ------------------------
    text = clean_transcript(transcript_path)

    with open(
        os.path.join(
            OUTPUT_TEXT,
            f"{participant_id}.txt",
        ),
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