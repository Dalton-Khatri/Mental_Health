"""
organize_daic_woz.py

Takes a DAIC-WOZ zip file where all participant files are loose ("flat")
inside the archive and reorganizes them into per-participant folders that
the downstream processing script (segment_daic_woz.py) expects.

Each participant has multiple files, for example:
    300_AUDIO.wav
    300_TRANSCRIPT.csv
    300_CLNF_AUs
    300_CLNF_features
    300_CLNF_features3D
    300_CLNF_gaze
    300_CLNF_hog
    300_CLNF_pose
    300_COVAREP.csv
    300_FORMANT.csv

ALL of these are moved into a single per-participant folder:

    OUTPUT_ROOT/
      300_P/
        300_AUDIO.wav
        300_TRANSCRIPT.csv
        300_CLNF_AUs
        300_CLNF_features
        ... (every file belonging to participant 300)
      301_P/
        301_AUDIO.wav
        ...

A participant is considered COMPLETE only if it has both
300_AUDIO.wav AND 300_TRANSCRIPT.csv -- the two files the
processing script strictly requires. All other files are copied
regardless, but their absence does not block folder creation.

Usage:
    python organize_daic_woz.py
    python organize_daic_woz.py path/to/archive.zip path/to/output_root
"""

import os
import re
import sys
import shutil
import zipfile
from collections import defaultdict

# ----------------------------
# Configuration
# ----------------------------
ZIP_PATH    = "archive(2).zip"
OUTPUT_ROOT = "daic_woz_processing"

# Set to True to move files instead of copying (saves disk space but
# removes the flat extracted backup copy).
MOVE_INSTEAD_OF_COPY = False

# Only participant IDs >= MIN_PARTICIPANT_ID are processed.
# Set MAX_PARTICIPANT_ID to None for no upper limit.
MIN_PARTICIPANT_ID = 396
MAX_PARTICIPANT_ID = None

# The two file suffixes that MUST be present for a participant to be
# considered complete. Everything else is copied but not required.
REQUIRED_SUFFIXES = {"AUDIO.wav", "TRANSCRIPT.csv"}

# Matches any file that starts with a numeric participant id followed by
# an underscore, e.g. "300_AUDIO.wav", "300_CLNF_AUs", "300_COVAREP.csv"
# Group 1 = participant id digits
# Group 2 = everything after the first underscore (the file's suffix/kind)
FILENAME_PATTERN = re.compile(r"^(\d+)_(.+)$", re.IGNORECASE)


# ----------------------------
# Helpers
# ----------------------------

def in_range(participant_id_int, min_id, max_id):
    """Return True if the integer id falls within [min_id, max_id]."""
    if min_id is not None and participant_id_int < min_id:
        return False
    if max_id is not None and participant_id_int > max_id:
        return False
    return True


def extract_zip(zip_path, extract_to, min_id=None, max_id=None):
    """
    Selectively extract only in-range participant files from the zip.
    Files belonging to out-of-range participants are never written to
    disk at all, saving both time and disk space.

    Files that don't match the '<digits>_<anything>' naming pattern
    (e.g. a stray readme.txt) are still extracted so they show up in
    the unmatched-files report rather than disappearing silently.
    """
    if not os.path.exists(zip_path):
        print(f"ERROR: zip file not found at: {zip_path}")
        sys.exit(1)

    os.makedirs(extract_to, exist_ok=True)

    print(f"Extracting {zip_path} ...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        all_names = zf.namelist()

        to_extract  = []
        skipped_count = 0

        for name in all_names:
            if name.endswith("/"):        # skip directory entries
                continue

            base_name = os.path.basename(name)
            match = FILENAME_PATTERN.match(base_name)

            if match:
                pid = int(match.group(1))
                if not in_range(pid, min_id, max_id):
                    skipped_count += 1
                    continue            # skip entirely -- never hits disk

            to_extract.append(name)

        for name in to_extract:
            zf.extract(name, extract_to)

    print(f"  Extracted {len(to_extract):,d} file(s)  |  "
          f"Skipped {skipped_count:,d} file(s) outside id range (never written to disk)")


def find_participant_files(flat_dir, min_id=None, max_id=None):
    """
    Walk the extracted folder and group every matched file under its
    participant id.

    Returns:
        participants  -- dict  {id_str: {suffix: full_path, ...}, ...}
        out_of_range  -- list  of paths that matched the pattern but
                         were outside the id range (should be empty if
                         extract_zip already filtered them, but kept as
                         a safety net)
    """
    participants = defaultdict(dict)
    out_of_range = []

    for root, _, files in os.walk(flat_dir):
        for fname in files:
            match = FILENAME_PATTERN.match(fname)
            if not match:
                continue

            pid_str = match.group(1)
            suffix  = match.group(2)           # e.g. "AUDIO.wav", "CLNF_AUs"
            pid_int = int(pid_str)
            full_path = os.path.join(root, fname)

            if not in_range(pid_int, min_id, max_id):
                out_of_range.append(full_path)
                continue

            participants[pid_str][suffix] = full_path

    return participants, out_of_range


def report_unmatched_files(flat_dir, participants, out_of_range):
    """
    Print files that either:
      - did not match the '<digits>_<anything>' pattern at all, or
      - matched but were outside the configured id range
    so nothing disappears silently.
    """
    matched_paths = set()
    for suffixes in participants.values():
        matched_paths.update(suffixes.values())

    out_of_range_set = set(out_of_range)

    unmatched = []
    for root, _, files in os.walk(flat_dir):
        for fname in files:
            full_path = os.path.join(root, fname)
            if full_path not in matched_paths and full_path not in out_of_range_set:
                unmatched.append(full_path)

    if out_of_range:
        print(f"\n  NOTE: {len(out_of_range):,d} file(s) matched the naming pattern "
              f"but were outside the id range -- skipped:")
        for p in sorted(out_of_range)[:20]:
            print(f"    {p}")
        if len(out_of_range) > 20:
            print(f"    ... and {len(out_of_range) - 20} more")

    if unmatched:
        print(f"\n  NOTE: {len(unmatched):,d} file(s) did not match the "
              f"'<id>_<anything>' naming pattern -- ignored:")
        for p in unmatched[:20]:
            print(f"    {p}")
        if len(unmatched) > 20:
            print(f"    ... and {len(unmatched) - 20} more")


def build_participant_folders(participants, output_root):
    """
    For each participant create <output_root>/<id>_P/ and copy (or move)
    ALL of their files into it.

    A participant is skipped (and reported as incomplete) only if it is
    missing AUDIO.wav or TRANSCRIPT.csv -- the two files the downstream
    processing script requires. All other files are copied regardless.
    """
    os.makedirs(output_root, exist_ok=True)

    complete   = []
    incomplete = []

    transfer = shutil.move if MOVE_INSTEAD_OF_COPY else shutil.copy2

    for pid_str in sorted(participants.keys(), key=lambda x: int(x)):
        suffixes = participants[pid_str]

        # Check only the required files
        missing = REQUIRED_SUFFIXES - set(suffixes.keys())
        if missing:
            incomplete.append((pid_str, missing))
            continue

        dest_folder = os.path.join(output_root, f"{pid_str}_P")
        os.makedirs(dest_folder, exist_ok=True)

        for suffix, src_path in suffixes.items():
            dest_path = os.path.join(dest_folder, f"{pid_str}_{suffix}")
            transfer(src_path, dest_path)

        complete.append(pid_str)
        print(f"  [{pid_str}]  {len(suffixes)} file(s) -> {dest_folder}")

    return complete, incomplete


# ----------------------------
# Main
# ----------------------------

def main():
    zip_path    = sys.argv[1] if len(sys.argv) > 1 else ZIP_PATH
    output_root = sys.argv[2] if len(sys.argv) > 2 else OUTPUT_ROOT

    print("=" * 70)
    print("DAIC-WOZ ZIP -> PER-PARTICIPANT FOLDER REORGANIZER")
    print("=" * 70)
    print(f"\n  Zip path    : {zip_path}")
    print(f"  Output root : {output_root}")
    print(f"  Mode        : {'MOVE (originals removed)' if MOVE_INSTEAD_OF_COPY else 'COPY (originals kept)'}")
    lo = MIN_PARTICIPANT_ID if MIN_PARTICIPANT_ID is not None else "(no min)"
    hi = MAX_PARTICIPANT_ID if MAX_PARTICIPANT_ID is not None else "(no max)"
    print(f"  ID range    : {lo} to {hi}")
    print(f"  Required    : {sorted(REQUIRED_SUFFIXES)}")

    # Step 1 -- selective extraction
    extract_dir = output_root.rstrip("/\\") + "_extracted_flat"
    extract_zip(zip_path, extract_dir,
                min_id=MIN_PARTICIPANT_ID, max_id=MAX_PARTICIPANT_ID)

    # Step 2 -- group by participant id
    print("\nScanning extracted files ...")
    participants, out_of_range = find_participant_files(
        extract_dir, min_id=MIN_PARTICIPANT_ID, max_id=MAX_PARTICIPANT_ID
    )
    print(f"  Found {len(participants):,d} distinct participant id(s) in range")

    # Report anything unexpected
    report_unmatched_files(extract_dir, participants, out_of_range)

    # Step 3 -- build output folders
    print(f"\nBuilding participant folders under: {output_root}")
    complete, incomplete = build_participant_folders(participants, output_root)

    # Step 4 -- summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"\n  Complete participants (all required files present) : {len(complete):,d}")
    print(f"  Incomplete participants (missing required file)    : {len(incomplete):,d}")

    if incomplete:
        print("\n  Incomplete participant details:")
        for pid_str, missing in incomplete:
            print(f"    ID {pid_str:>6s}  missing: {sorted(missing)}")

    print(f"\n  Output folders   : {os.path.abspath(output_root)}/")
    print(f"  Temp extract dir : {os.path.abspath(extract_dir)}/")
    print(f"  (Safe to delete the temp extract dir once you have verified the output)")

    print("\nDone. Set DATASET_PATH in the processing script to:")
    print(f"  {os.path.abspath(output_root)}")


if __name__ == "__main__":
    main()
