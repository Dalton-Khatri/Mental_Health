import os
import pandas as pd
import numpy as np
from sklearn.utils.class_weight import compute_class_weight

# ----------------------------
# Paths
# ----------------------------
SPLIT_DIR       = "D:/daic_woz_processing/splits"   # folder containing the four CSVs
PROCESSED_AUDIO = "processed/audio"
PROCESSED_TEXT  = "processed/transcript"
OUTPUT_DIR      = "processed/splits"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ----------------------------
# Split CSV filenames
# ----------------------------
TRAIN_CSV     = os.path.join(SPLIT_DIR, "train_split_Depression_AVEC2017.csv")
DEV_CSV       = os.path.join(SPLIT_DIR, "dev_split_Depression_AVEC2017.csv")
TEST_CSV      = os.path.join(SPLIT_DIR, "test_split_Depression_AVEC2017.csv")
FULL_TEST_CSV = os.path.join(SPLIT_DIR, "full_test_split.csv")


# ---------------------------------------------------------
# Load one split CSV and normalize column names.
# Handles the quirks we know about:
#   - test CSV has lowercase participant_ID
#   - full_test uses PHQ_Binary / PHQ_Score (no "8")
# ---------------------------------------------------------
def load_split(path, split_name):

    df = pd.read_csv(path)

    # normalize all column names to lowercase + strip spaces
    df.columns = [c.strip().lower() for c in df.columns]

    # unify participant id column name
    if "participant_id" not in df.columns:
        raise ValueError(f"{split_name}: no participant_id column found. Columns: {df.columns.tolist()}")

    df = df.rename(columns={"participant_id": "participant_id"})  # already lowercase now
    df["participant_id"] = df["participant_id"].astype(int)

    # unify label column names (full_test uses phq_binary / phq_score, others use phq8_*)
    if "phq_binary" in df.columns and "phq8_binary" not in df.columns:
        df = df.rename(columns={"phq_binary": "phq8_binary", "phq_score": "phq8_score"})

    df["split"] = split_name

    return df


# ---------------------------------------------------------
# Check whether the processed audio + transcript files
# actually exist for a given participant ID
# ---------------------------------------------------------
def files_exist(participant_id):

    audio = os.path.join(PROCESSED_AUDIO, f"{participant_id}.wav")
    text  = os.path.join(PROCESSED_TEXT,  f"{participant_id}.txt")

    return os.path.exists(audio) and os.path.exists(text)


# ---------------------------------------------------------
# Load all splits
# ---------------------------------------------------------
print("Loading split CSVs ...")

train     = load_split(TRAIN_CSV,     "train")
dev       = load_split(DEV_CSV,       "dev")
test      = load_split(TEST_CSV,      "test")
full_test = load_split(FULL_TEST_CSV, "full_test")

# use full_test as our labeled test set (test has no labels)
# keep plain test around just so nothing breaks if someone references it
print(f"  Train     : {len(train)} participants")
print(f"  Dev       : {len(dev)} participants")
print(f"  Test      : {len(test)} participants (no labels)")
print(f"  Full test : {len(full_test)} participants (labeled)")


# ---------------------------------------------------------
# Cross-check against processed files
# Flag any participant whose audio/transcript is missing
# ---------------------------------------------------------
print("\nChecking processed files exist ...")

for df, name in [(train, "train"), (dev, "dev"), (full_test, "full_test")]:

    df["files_ok"] = df["participant_id"].apply(files_exist)
    missing = df[~df["files_ok"]]["participant_id"].tolist()

    if missing:
        print(f"  [WARNING] {name} — missing processed files for: {missing}")
    else:
        print(f"  {name} — all processed files found")


# ---------------------------------------------------------
# Class distribution in train set
# ---------------------------------------------------------
if "phq8_binary" in train.columns:

    counts = train["phq8_binary"].value_counts().sort_index()
    print(f"\nTrain class distribution:")
    print(f"  Not depressed (0): {counts.get(0, 0)}")
    print(f"  Depressed     (1): {counts.get(1, 0)}")

    # class weights — pass these to your classifier / loss function
    labels = train["phq8_binary"].values
    classes = np.array([0, 1])
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=labels)
    class_weights = {0: round(weights[0], 4), 1: round(weights[1], 4)}

    print(f"\nClass weights (use in classifier / loss function):")
    print(f"  {{0: {class_weights[0]}, 1: {class_weights[1]}}}")


# ---------------------------------------------------------
# Save clean manifest CSVs for downstream stages to read
# Each CSV has: participant_id, phq8_binary, phq8_score,
# gender, the 8 subscale columns (where available), split,
# and the absolute paths to the processed audio + text files
# ---------------------------------------------------------
def add_file_paths(df):

    df = df.copy()
    df["audio_path"] = df["participant_id"].apply(
        lambda pid: os.path.abspath(os.path.join(PROCESSED_AUDIO, f"{pid}.wav"))
    )
    df["text_path"] = df["participant_id"].apply(
        lambda pid: os.path.abspath(os.path.join(PROCESSED_TEXT, f"{pid}.txt"))
    )

    return df


train     = add_file_paths(train)
dev       = add_file_paths(dev)
full_test = add_file_paths(full_test)

train.to_csv(os.path.join(OUTPUT_DIR, "train.csv"),     index=False)
dev.to_csv(os.path.join(OUTPUT_DIR, "dev.csv"),         index=False)
full_test.to_csv(os.path.join(OUTPUT_DIR, "test.csv"),  index=False)

# also save class weights so downstream stages don't recompute them
pd.DataFrame([class_weights]).to_csv(
    os.path.join(OUTPUT_DIR, "class_weights.csv"), index=False
)

print(f"\nManifests saved to {OUTPUT_DIR}/")
print("  train.csv")
print("  dev.csv")
print("  test.csv        (full_test — labeled)")
print("  class_weights.csv")
