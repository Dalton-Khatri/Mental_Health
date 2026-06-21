"""
prepare_datasets.py

Cleans, tags, splits, and combines the Mukherjee, Dreaddit, and CAMS
datasets for a dual head mental health text classifier.

Head 1 (Condition): trained on Mukherjee + Dreaddit combined.
Head 2 (Cause):     trained on CAMS alone.

This script does NOT train any model. It only produces clean, labeled,
split, and tagged CSV files ready for training later.

"""

import os
import re
import sys
import random

# Handle Windows console encoding so printing non-ASCII text does not crash
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from collections import Counter, OrderedDict

# Paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

RAW_PATHS = {
    "mukherjee": os.path.join(PROJECT_ROOT, "Text_dataset", "Mukherjee", "mental_heath_unbanlanced.csv"),
    "dreaddit_train": os.path.join(PROJECT_ROOT, "Text_dataset", "Dreaddit", "dreaddit-train.csv"),
    "dreaddit_test": os.path.join(PROJECT_ROOT, "Text_dataset", "Dreaddit", "dreaddit-test.csv"),
    "cams": os.path.join(PROJECT_ROOT, "Text_dataset", "CAMS", "CAMS.csv"),
}

OUTPUT_DIRS = {
    "raw": os.path.join(PROJECT_ROOT, "data", "raw"),
    "cleaned": os.path.join(PROJECT_ROOT, "data", "cleaned"),
    "splits": os.path.join(PROJECT_ROOT, "data", "splits"),
    "combined": os.path.join(PROJECT_ROOT, "data", "combined"),
}

RANDOM_SEED = 42

# The exact CAMS category mapping provided by the team
CAMS_CATEGORY_MAP = {
    0: "No reason",
    1: "Bias or abuse",
    2: "Jobs and careers",
    3: "Medication",
    4: "Relationship",
    5: "Alienation",
}

# Known correct Mukherjee labels and a map for fixing typos
MUKHERJEE_VALID_LABELS = [
    "Anxiety",
    "Bipolar",
    "Depression",
    "Normal",
    "Personality disorder",
    "Stress",
    "Suicidal",
]

# Helpers
def ensure_dirs():
    """Create all output directories if they do not already exist."""
    for d in OUTPUT_DIRS.values():
        os.makedirs(d, exist_ok=True)


def word_count(text):
    """Return the number of whitespace separated tokens in a string."""
    if not isinstance(text, str):
        return 0
    return len(text.split())


def print_label_distribution(df, col, title=""):
    """Print the value counts for a label column, nicely formatted."""
    if title:
        print(f"\n  {title}")
    counts = df[col].value_counts()
    total = len(df)
    for label, count in counts.items():
        pct = 100 * count / total
        print(f"    {str(label):25s}  {count:>7,d}  ({pct:5.1f}%)")
    print(f"    {'TOTAL':25s}  {total:>7,d}")


def print_text_length_stats(df, col, label=""):
    """Print word count stats (mean, median, min, max) for a text column."""
    wc = df[col].apply(word_count)
    print(f"  {label} word count  mean={wc.mean():.1f}  median={wc.median():.0f}  "
          f"min={wc.min()}  max={wc.max()}")


def print_side_by_side_samples(df, raw_col, clean_col, n=5):
    """Show a few random rows before and after cleaning so a person can eyeball them."""
    sample = df.sample(n=min(n, len(df)), random_state=RANDOM_SEED)
    print(f"\n  Side by side samples (raw vs cleaned), {len(sample)} rows:")
    for idx, row in sample.iterrows():
        raw = str(row[raw_col])[:120]
        clean = str(row[clean_col])[:120]
        print(f"    ROW {idx}")
        print(f"      RAW:     {raw}")
        print(f"      CLEANED: {clean}")
        print()


def check_split_overlap(train_df, val_df, test_df, text_col):
    """Confirm there is zero text overlap across the three splits."""
    train_set = set(train_df[text_col].tolist())
    val_set = set(val_df[text_col].tolist())
    test_set = set(test_df[text_col].tolist())

    tv = len(train_set & val_set)
    tt = len(train_set & test_set)
    vt = len(val_set & test_set)

    if tv + tt + vt == 0:
        print("  Overlap check: PASSED (zero shared texts between any two splits)")
    else:
        print(f"  WARNING overlap detected  train-val={tv}  train-test={tt}  val-test={vt}")


# Text cleaning pipeline (shared across all three datasets)
def clean_text(text):
    """
    Apply all text cleaning steps to a single string.
    Returns the cleaned string, or empty string if input is not usable.
    """
    if not isinstance(text, str):
        return ""

    # Remove URLs
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"www\.\S+", "", text)
    # Some Dreaddit rows have a literal <url> placeholder
    text = re.sub(r"<url>", "", text, flags=re.IGNORECASE)

    # Remove Reddit user handles (u/name or /u/name)
    text = re.sub(r"/?u/[A-Za-z0-9_-]+", "", text)

    # Remove subreddit references (r/name or /r/name)
    text = re.sub(r"/?r/[A-Za-z0-9_-]+", "", text)

    # Remove markdown formatting characters
    text = re.sub(r"#{1,6}\s*", "", text)       # headings
    text = re.sub(r"\*{1,3}", "", text)          # bold/italic
    text = re.sub(r"_{1,3}", "", text)           # bold/italic underscores
    text = re.sub(r"~~", "", text)               # strikethrough
    text = re.sub(r"&gt;", "", text)             # quoted block (html entity)
    text = re.sub(r"&amp;", "&", text)           # ampersand entity
    text = re.sub(r"&#x200B;", "", text)         # zero width space entity
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)  # markdown links, keep text

    # Remove placeholder text
    text = re.sub(r"\[deleted\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[removed\]", "", text, flags=re.IGNORECASE)

    # Collapse excessive whitespace and newlines into single spaces
    text = re.sub(r"\s+", " ", text).strip()

    return text

# Step 1: Load and inspect each raw dataset

def load_and_inspect():
    """
    Load the three raw datasets into DataFrames and print basic stats
    so we can confirm the shape of the data before writing any cleaning code.
    """
    print("=" * 70)
    print("STEP 1: Load and inspect each raw dataset")
    print("=" * 70)

    # Mukherjee (only the unbalanced file, per team decision)
    muk = pd.read_csv(RAW_PATHS["mukherjee"])
    print(f"\nMukherjee: {len(muk):,d} rows, columns: {list(muk.columns)}")
    print_label_distribution(muk, "status", "Label distribution (status):")
    print(f"  Sample rows:\n{muk.head(3).to_string()}\n")

    # Dreaddit (combine the existing train and test into one pool)
    dread_tr = pd.read_csv(RAW_PATHS["dreaddit_train"])
    dread_te = pd.read_csv(RAW_PATHS["dreaddit_test"])
    dread = pd.concat([dread_tr, dread_te], ignore_index=True)
    print(f"Dreaddit: {len(dread_tr):,d} train + {len(dread_te):,d} test = {len(dread):,d} rows")
    print(f"  Columns: {list(dread.columns)[:10]} ... ({len(dread.columns)} total)")
    print_label_distribution(dread, "label", "Stress label distribution:")
    print(f"  Subreddits: {dict(dread['subreddit'].value_counts())}\n")

    # CAMS
    cams = pd.read_csv(RAW_PATHS["cams"])
    print(f"CAMS: {len(cams):,d} rows, columns: {list(cams.columns)}")
    print_label_distribution(cams, "category", "Category distribution (raw numeric):")
    print(f"  Sample rows:\n{cams.head(3).to_string()}\n")

    return muk, dread, cams

# Step 2: Clean Mukherjee

def fix_mukherjee_labels(df):
    """
    Standardize the status column. Fix obvious typos by finding the
    closest valid label for any value that is not already in the canonical list.
    Prints every correction so the team can review.
    """
    corrections = []
    valid_lower = {v.lower(): v for v in MUKHERJEE_VALID_LABELS}

    def fix_one(raw_label):
        if not isinstance(raw_label, str):
            return raw_label
        stripped = raw_label.strip()

        # Already valid (exact match after strip)
        if stripped in MUKHERJEE_VALID_LABELS:
            return stripped

        # Try case insensitive match
        if stripped.lower() in valid_lower:
            fixed = valid_lower[stripped.lower()]
            corrections.append((raw_label, fixed, "case fix"))
            return fixed

        # Try prefix match (catches truncations like "Anxiet")
        for valid in MUKHERJEE_VALID_LABELS:
            if valid.lower().startswith(stripped.lower()) and len(stripped) >= 3:
                corrections.append((raw_label, valid, "prefix match"))
                return valid

        # If nothing matched, leave it and flag it
        corrections.append((raw_label, raw_label, "NO MATCH FOUND"))
        return stripped

    df["status"] = df["status"].apply(fix_one)

    if corrections:
        print(f"\n  Label corrections applied ({len(corrections)} total):")
        correction_summary = Counter([(c[0], c[1], c[2]) for c in corrections])
        for (orig, fixed, reason), count in correction_summary.most_common():
            print(f"    '{orig}' -> '{fixed}' ({reason}) x{count}")
    else:
        print("\n  No label corrections needed.")

    return df


def clean_mukherjee(muk):
    """
    Clean the Mukherjee dataset: fix labels, clean text, remove
    duplicates and empty rows. Keeps the original text in raw_text.
    """
    print("\n" + "=" * 70)
    print("STEP 2: Clean Mukherjee")
    print("=" * 70)

    rows_before = len(muk)

    # Fix labels first
    muk = fix_mukherjee_labels(muk)
    print_label_distribution(muk, "status", "Labels after standardization:")

    # Text cleaning
    muk = muk.rename(columns={"text": "raw_text"})
    muk["cleaned_text"] = muk["raw_text"].apply(clean_text)

    print_text_length_stats(muk, "raw_text", "Before cleaning:")
    print_text_length_stats(muk, "cleaned_text", "After cleaning:")

    # Remove duplicates on cleaned text
    dupes = muk.duplicated(subset=["cleaned_text"], keep="first").sum()
    muk = muk.drop_duplicates(subset=["cleaned_text"], keep="first").reset_index(drop=True)
    dupe_pct = 100 * dupes / rows_before
    print(f"\n  Duplicates removed: {dupes:,d} ({dupe_pct:.1f}% of original)")
    if dupe_pct > 5:
        print(f"  FLAG: duplicate rate {dupe_pct:.1f}% is above 5%, worth a second look")

    # Remove empty or near empty rows (fewer than 3 words)
    empty_mask = muk["cleaned_text"].apply(word_count) < 3
    n_empty = empty_mask.sum()
    if n_empty > 0:
        print(f"  Empty/near-empty rows removed: {n_empty:,d}")
        muk = muk[~empty_mask].reset_index(drop=True)

    rows_after = len(muk)
    print(f"\n  Rows before: {rows_before:,d}  after: {rows_after:,d}  "
          f"dropped: {rows_before - rows_after:,d}")

    print_label_distribution(muk, "status", "Final label distribution:")
    print_side_by_side_samples(muk, "raw_text", "cleaned_text")

    return muk


# Step 3: Clean Dreaddit

def clean_dreaddit(dread):
    """
    Clean Dreaddit text while preserving the binary label, subreddit,
    and confidence columns. Same cleaning pipeline as Mukherjee.
    """
    print("\n" + "=" * 70)
    print("STEP 3: Clean Dreaddit")
    print("=" * 70)

    rows_before = len(dread)

    # Keep only the columns we actually need going forward
    keep_cols = ["text", "label", "subreddit", "confidence"]
    dread = dread[keep_cols].copy()

    dread = dread.rename(columns={"text": "raw_text"})
    dread["cleaned_text"] = dread["raw_text"].apply(clean_text)

    print_text_length_stats(dread, "raw_text", "Before cleaning:")
    print_text_length_stats(dread, "cleaned_text", "After cleaning:")

    # Remove duplicates
    dupes = dread.duplicated(subset=["cleaned_text"], keep="first").sum()
    dread = dread.drop_duplicates(subset=["cleaned_text"], keep="first").reset_index(drop=True)
    dupe_pct = 100 * dupes / rows_before
    print(f"\n  Duplicates removed: {dupes:,d} ({dupe_pct:.1f}% of original)")
    if dupe_pct > 5:
        print(f"  FLAG: duplicate rate {dupe_pct:.1f}% is above 5%, worth a second look")

    # Remove empty or near empty rows
    empty_mask = dread["cleaned_text"].apply(word_count) < 3
    n_empty = empty_mask.sum()
    if n_empty > 0:
        print(f"  Empty/near-empty rows removed: {n_empty:,d}")
        dread = dread[~empty_mask].reset_index(drop=True)

    rows_after = len(dread)
    print(f"\n  Rows before: {rows_before:,d}  after: {rows_after:,d}  "
          f"dropped: {rows_before - rows_after:,d}")

    print_label_distribution(dread, "label", "Stress label distribution:")
    print(f"  Subreddits after cleaning: {dict(dread['subreddit'].value_counts())}")
    print_side_by_side_samples(dread, "raw_text", "cleaned_text")

    return dread


# Step 4: Fold Dreaddit into the Condition taxonomy

def fold_dreaddit_condition(dread):
    """
    Create condition_label for Dreaddit rows.
    label==1 becomes "Stress", label==0 becomes "Normal".
    Verify the counts match the original binary label counts.
    """
    print("\n" + "=" * 70)
    print("STEP 4: Fold Dreaddit into the Condition taxonomy")
    print("=" * 70)

    original_stress_count = (dread["label"] == 1).sum()
    original_not_stress_count = (dread["label"] == 0).sum()

    dread["condition_label"] = dread["label"].map({1: "Stress", 0: "Normal"})

    new_stress_count = (dread["condition_label"] == "Stress").sum()
    new_normal_count = (dread["condition_label"] == "Normal").sum()

    print(f"\n  Original label==1 (stressed):     {original_stress_count:,d}")
    print(f"  New condition_label=='Stress':     {new_stress_count:,d}")
    stress_match = original_stress_count == new_stress_count
    print(f"  Match: {'YES' if stress_match else 'NO  <--- PROBLEM'}")

    print(f"\n  Original label==0 (not stressed):  {original_not_stress_count:,d}")
    print(f"  New condition_label=='Normal':      {new_normal_count:,d}")
    normal_match = original_not_stress_count == new_normal_count
    print(f"  Match: {'YES' if normal_match else 'NO  <--- PROBLEM'}")

    # Check for any nulls in the new column
    nulls = dread["condition_label"].isna().sum()
    if nulls > 0:
        print(f"  WARNING: {nulls} rows have null condition_label")

    print_label_distribution(dread, "condition_label", "Condition label distribution:")

    return dread


# Step 5: Clean CAMS

def clean_cams(cams):
    """
    Clean CAMS text, map numeric categories to readable names, remove
    duplicates and empties. Same text cleaning pipeline as the others.
    """
    print("\n" + "=" * 70)
    print("STEP 5: Clean CAMS")
    print("=" * 70)

    rows_before = len(cams)

    # Map numeric categories to text labels
    cams["category_name"] = cams["category"].map(CAMS_CATEGORY_MAP)
    unmapped = cams["category_name"].isna().sum()
    if unmapped > 0:
        print(f"  WARNING: {unmapped} rows have unmapped category values, dropping them")
        print(f"  Unmapped values: {cams[cams['category_name'].isna()]['category'].unique()}")
        cams = cams[cams["category_name"].notna()].reset_index(drop=True)

    print_label_distribution(cams, "category_name", "Category distribution (mapped):")

    # Text cleaning
    cams = cams.rename(columns={"text": "raw_text"})
    cams["cleaned_text"] = cams["raw_text"].apply(clean_text)

    print_text_length_stats(cams, "raw_text", "Before cleaning:")
    print_text_length_stats(cams, "cleaned_text", "After cleaning:")

    # Remove duplicates
    dupes = cams.duplicated(subset=["cleaned_text"], keep="first").sum()
    cams = cams.drop_duplicates(subset=["cleaned_text"], keep="first").reset_index(drop=True)
    dupe_pct = 100 * dupes / rows_before
    print(f"\n  Duplicates removed: {dupes:,d} ({dupe_pct:.1f}% of original)")
    if dupe_pct > 5:
        print(f"  FLAG: duplicate rate {dupe_pct:.1f}% is above 5%, worth a second look")

    # Remove empty or near empty rows
    empty_mask = cams["cleaned_text"].apply(word_count) < 3
    n_empty = empty_mask.sum()
    if n_empty > 0:
        print(f"  Empty/near-empty rows removed: {n_empty:,d}")
        cams = cams[~empty_mask].reset_index(drop=True)

    rows_after = len(cams)
    print(f"\n  Rows before: {rows_before:,d}  after: {rows_after:,d}  "
          f"dropped: {rows_before - rows_after:,d}")

    print_label_distribution(cams, "category_name", "Final category distribution:")
    print_side_by_side_samples(cams, "raw_text", "cleaned_text")

    return cams


# Step 6: Tag every row with its source dataset

def tag_source(df, source_name):
    """Add a source_dataset column so we always know where each row came from."""
    df["source_dataset"] = source_name
    return df


def verify_tags(*dfs):
    """Confirm every row across all provided DataFrames has a non empty source tag."""
    print("\n" + "=" * 70)
    print("STEP 6: Tag every row with source_dataset")
    print("=" * 70)

    total = 0
    missing = 0
    for df in dfs:
        total += len(df)
        missing += df["source_dataset"].isna().sum()
        missing += (df["source_dataset"] == "").sum()

    print(f"\n  Total rows across all datasets: {total:,d}")
    print(f"  Rows with missing source tag:   {missing}")
    if missing == 0:
        print("  Tag check: PASSED")
    else:
        print("  Tag check: FAILED  <--- some rows have no source tag")


# Step 7: Split each dataset (80/10/10 stratified)

def split_dataset(df, label_col, name):
    """
    Stratified split into train (80%), val (10%), test (10%).
    Two step split: first 80/20, then split the 20 into 50/50.
    Saves each split and prints class distributions and overlap check.
    """
    print(f"\n  Splitting {name} ({len(df):,d} rows) on '{label_col}'...")

    # Step one: 80/20
    train_df, temp_df = train_test_split(
        df, test_size=0.2, random_state=RANDOM_SEED,
        stratify=df[label_col]
    )

    # Step two: split the 20 into 50/50 for val and test (each 10% of total)
    val_df, test_df = train_test_split(
        temp_df, test_size=0.5, random_state=RANDOM_SEED,
        stratify=temp_df[label_col]
    )

    train_df = train_df.reset_index(drop=True)
    val_df = val_df.reset_index(drop=True)
    test_df = test_df.reset_index(drop=True)

    print(f"    train: {len(train_df):,d}  val: {len(val_df):,d}  test: {len(test_df):,d}")

    # Print class distribution side by side
    print(f"\n    Class distribution comparison for {name}:")
    all_labels = sorted(df[label_col].unique())
    header = f"    {'Label':25s} {'Train':>10s} {'Val':>10s} {'Test':>10s}"
    print(header)
    print("    " + "-" * (len(header) - 4))
    for label in all_labels:
        tr_c = (train_df[label_col] == label).sum()
        va_c = (val_df[label_col] == label).sum()
        te_c = (test_df[label_col] == label).sum()
        tr_p = 100 * tr_c / len(train_df)
        va_p = 100 * va_c / len(val_df)
        te_p = 100 * te_c / len(test_df)
        print(f"    {str(label):25s} {tr_c:>6,d} ({tr_p:4.1f}%) {va_c:>5,d} ({va_p:4.1f}%) "
              f"{te_c:>5,d} ({te_p:4.1f}%)")

    # Check for overlap
    check_split_overlap(train_df, val_df, test_df, "cleaned_text")

    # Save
    splits_dir = OUTPUT_DIRS["splits"]
    train_path = os.path.join(splits_dir, f"{name}_train.csv")
    val_path = os.path.join(splits_dir, f"{name}_val.csv")
    test_path = os.path.join(splits_dir, f"{name}_test.csv")

    train_df.to_csv(train_path, index=False)
    val_df.to_csv(val_path, index=False)
    test_df.to_csv(test_path, index=False)

    print(f"    Saved: {train_path}")
    print(f"    Saved: {val_path}")
    print(f"    Saved: {test_path}")

    return train_df, val_df, test_df


def run_all_splits(muk, dread, cams):
    """Split all three datasets and return the splits for combining."""
    print("\n" + "=" * 70)
    print("STEP 7: Split each dataset (80/10/10 stratified)")
    print("=" * 70)

    muk_train, muk_val, muk_test = split_dataset(muk, "status", "mukherjee")
    dread_train, dread_val, dread_test = split_dataset(dread, "condition_label", "dreaddit")
    cams_train, cams_val, cams_test = split_dataset(cams, "category_name", "cams")

    return (muk_train, muk_val, muk_test,
            dread_train, dread_val, dread_test,
            cams_train, cams_val, cams_test)


# Step 8: Combine for Head 1, keep CAMS separate for Head 2

def combine_for_heads(muk_train, muk_val, muk_test,
                      dread_train, dread_val, dread_test,
                      cams_train, cams_val, cams_test):
    """
    Head 1: combine Mukherjee + Dreaddit train/val/test.
    Head 2: CAMS stays separate, just copy to the combined folder.
    """
    print("\n" + "=" * 70)
    print("STEP 8: Combine for each model head")
    print("=" * 70)

    combined_dir = OUTPUT_DIRS["combined"]

    # For Head 1, Mukherjee uses "status" as its condition label and
    # Dreaddit uses "condition_label". We need a unified column.
    # Rename Mukherjee's status to condition_label for the combined set.

    def prep_muk_for_combine(df):
        out = df[["cleaned_text", "raw_text", "status", "source_dataset"]].copy()
        out = out.rename(columns={"status": "condition_label"})
        return out

    def prep_dread_for_combine(df):
        out = df[["cleaned_text", "raw_text", "condition_label", "source_dataset",
                   "subreddit"]].copy()
        return out

    for split_name, m_split, d_split in [("train", muk_train, dread_train),
                                          ("val", muk_val, dread_val),
                                          ("test", muk_test, dread_test)]:
        m_prep = prep_muk_for_combine(m_split)
        d_prep = prep_dread_for_combine(d_split)
        combined = pd.concat([m_prep, d_prep], ignore_index=True)

        out_path = os.path.join(combined_dir, f"head1_{split_name}.csv")
        combined.to_csv(out_path, index=False)

        print(f"\n  head1_{split_name}.csv: {len(combined):,d} rows")
        source_counts = combined["source_dataset"].value_counts()
        for src, cnt in source_counts.items():
            pct = 100 * cnt / len(combined)
            print(f"    {src}: {cnt:,d} ({pct:.1f}%)")
        print_label_distribution(combined, "condition_label",
                                 f"Condition label distribution in head1_{split_name}:")
        print(f"    Saved: {out_path}")

    # Head 2: copy CAMS splits to combined folder
    for split_name, c_split in [("train", cams_train),
                                 ("val", cams_val),
                                 ("test", cams_test)]:
        out_path = os.path.join(combined_dir, f"cams_{split_name}.csv")
        c_split.to_csv(out_path, index=False)
        print(f"\n  cams_{split_name}.csv: {len(c_split):,d} rows")
        print(f"    Saved: {out_path}")


# Save cleaned files and raw copies

def save_cleaned(muk, dread, cams):
    """Save the cleaned (but not yet split) datasets."""
    cleaned_dir = OUTPUT_DIRS["cleaned"]

    muk_path = os.path.join(cleaned_dir, "mukherjee_cleaned.csv")
    dread_path = os.path.join(cleaned_dir, "dreaddit_cleaned.csv")
    cams_path = os.path.join(cleaned_dir, "cams_cleaned.csv")

    muk.to_csv(muk_path, index=False)
    dread.to_csv(dread_path, index=False)
    cams.to_csv(cams_path, index=False)

    print(f"\n  Saved cleaned files:")
    print(f"    {muk_path} ({len(muk):,d} rows)")
    print(f"    {dread_path} ({len(dread):,d} rows)")
    print(f"    {cams_path} ({len(cams):,d} rows)")


def copy_raw_files():
    """Copy originals to data/raw/ so they are preserved alongside outputs."""
    import shutil
    raw_dir = OUTPUT_DIRS["raw"]

    copies = {
        "mukherjee_raw.csv": RAW_PATHS["mukherjee"],
        "dreaddit_train_raw.csv": RAW_PATHS["dreaddit_train"],
        "dreaddit_test_raw.csv": RAW_PATHS["dreaddit_test"],
        "cams_raw.csv": RAW_PATHS["cams"],
    }
    for dest_name, src in copies.items():
        dest = os.path.join(raw_dir, dest_name)
        if not os.path.exists(dest):
            shutil.copy2(src, dest)
            print(f"  Copied {src} -> {dest}")
        else:
            print(f"  Already exists: {dest}")

def main():
    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)

    print("\n" + "#" * 70)
    print("  DATASET PREPARATION PIPELINE")
    print("#" * 70)

    ensure_dirs()

    # Step 1
    muk, dread, cams = load_and_inspect()

    # Step 2
    muk = clean_mukherjee(muk)

    # Step 3
    dread = clean_dreaddit(dread)

    # Step 4
    dread = fold_dreaddit_condition(dread)

    # Step 5
    cams = clean_cams(cams)

    # Step 6
    muk = tag_source(muk, "mukherjee")
    dread = tag_source(dread, "dreaddit")
    cams = tag_source(cams, "cams")
    verify_tags(muk, dread, cams)

    # Save cleaned files before splitting
    save_cleaned(muk, dread, cams)

    # Copy raw files to data/raw/
    print("\n  Copying raw files to data/raw/ ...")
    copy_raw_files()

    # Step 7
    (muk_train, muk_val, muk_test,
     dread_train, dread_val, dread_test,
     cams_train, cams_val, cams_test) = run_all_splits(muk, dread, cams)

    # Step 8
    combine_for_heads(muk_train, muk_val, muk_test,
                      dread_train, dread_val, dread_test,
                      cams_train, cams_val, cams_test)

    # Final confirmation
    print("\n" + "#" * 70)
    print("  PIPELINE COMPLETE")
    print("#" * 70)
    print("\n  Splitting happened BEFORE combining: YES (confirmed by code order)")
    print("\n  Output folder structure:")
    for label, d in OUTPUT_DIRS.items():
        if os.path.exists(d):
            files = os.listdir(d)
            print(f"    {d}/")
            for f in sorted(files):
                fpath = os.path.join(d, f)
                size_mb = os.path.getsize(fpath) / (1024 * 1024)
                print(f"      {f}  ({size_mb:.1f} MB)")

    print("\nDone.")


if __name__ == "__main__":
    main()
