import os
import re
import pandas as pd
from sklearn.model_selection import train_test_split

# ── Paths ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, "..")
INPUT_PATH = os.path.join(PROJECT_ROOT, "Text_dataset", "combined_cause_dataset.csv")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data", "combined")

os.makedirs(OUTPUT_DIR, exist_ok=True)

SEED = 42

# ── Load ──
print("=" * 60)
print("HEAD 2 DATASET SPLIT")
print("=" * 60)

df = pd.read_csv(INPUT_PATH)
print(f"\nLoaded: {INPUT_PATH}")
print(f"Shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(f"\nSource distribution:")
for src, count in df["source"].value_counts().items():
    print(f"  {src}: {count:,d} ({100*count/len(df):.1f}%)")
print(f"\nClass distribution:")
for cls, count in df["category_name"].value_counts().items():
    print(f"  {cls:20s}: {count:>5,d} ({100*count/len(df):.1f}%)")


# ── Clean text ──
def clean_text(text):
    """Basic text cleaning matching Head 1 preprocessing style."""
    if pd.isna(text) or not isinstance(text, str):
        return ""
    text = text.strip()
    # Remove URLs
    text = re.sub(r"http\S+|www\.\S+", "", text)
    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text)
    # Remove carriage returns
    text = text.replace("\\r\\n", " ").replace("\r\n", " ")
    text = text.replace("\\r", " ").replace("\\n", " ")
    text = text.replace("\r", " ").replace("\n", " ")
    # Clean up again
    text = re.sub(r"\s+", " ", text).strip()
    return text


print("\nCleaning text...")
df["cleaned_text"] = df["text"].apply(clean_text)

# Drop rows with empty cleaned text
before = len(df)
df = df[df["cleaned_text"].str.len() > 0].reset_index(drop=True)
after = len(df)
if before != after:
    print(f"  Dropped {before - after} empty rows")
else:
    print(f"  No empty rows")

# Rename source column to match Head 1 convention
df = df.rename(columns={"source": "source_dataset"})
df["source_dataset"] = df["source_dataset"].str.lower()  # cams, sad


# ── Stratified split: 80/10/10 ──
print("\nSplitting 80% train / 10% val / 10% test (stratified by category_name)...")

train_df, temp_df = train_test_split(
    df, test_size=0.2, random_state=SEED, stratify=df["category_name"]
)
val_df, test_df = train_test_split(
    temp_df, test_size=0.5, random_state=SEED, stratify=temp_df["category_name"]
)

print(f"  Train: {len(train_df):,d}")
print(f"  Val:   {len(val_df):,d}")
print(f"  Test:  {len(test_df):,d}")

# Keep only the columns needed for training
keep_cols = ["cleaned_text", "category_name", "source_dataset"]

train_out = train_df[keep_cols].reset_index(drop=True)
val_out = val_df[keep_cols].reset_index(drop=True)
test_out = test_df[keep_cols].reset_index(drop=True)


# ── Print class distribution per split ──
for name, split_df in [("Train", train_out), ("Val", val_out), ("Test", test_out)]:
    print(f"\n  {name} class distribution:")
    for cls, count in split_df["category_name"].value_counts().sort_index().items():
        print(f"    {cls:20s}: {count:>5,d}")


# ── Save ──
train_path = os.path.join(OUTPUT_DIR, "head2_train.csv")
val_path = os.path.join(OUTPUT_DIR, "head2_val.csv")
test_path = os.path.join(OUTPUT_DIR, "head2_test.csv")

train_out.to_csv(train_path, index=False)
val_out.to_csv(val_path, index=False)
test_out.to_csv(test_path, index=False)

print(f"\nSaved:")
print(f"  {train_path}")
print(f"  {val_path}")
print(f"  {test_path}")


# ── Remove old CAMS files ──
old_files = ["cams_train.csv", "cams_val.csv", "cams_test.csv"]
removed = []
for fname in old_files:
    fpath = os.path.join(OUTPUT_DIR, fname)
    if os.path.exists(fpath):
        os.remove(fpath)
        removed.append(fname)

if removed:
    print(f"\nRemoved old files: {', '.join(removed)}")
else:
    print("\nNo old CAMS files to remove.")


# ── Final summary ──
print(f"\n{'=' * 60}")
print("DONE")
print(f"{'=' * 60}")
print(f"Total rows: {len(df):,d} (CAMS + SAD combined)")
print(f"Train: {len(train_out):,d} | Val: {len(val_out):,d} | Test: {len(test_out):,d}")
print(f"Columns: {list(train_out.columns)}")
print(f"\nThese files replace the old cams_train/val/test.csv files.")
print(f"Update the Phase 4 notebook to use head2_train/val/test.csv.")
