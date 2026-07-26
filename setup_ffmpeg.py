"""
FFmpeg Setup Script for SerenityScreen
---------------------------------------
Downloads a full-featured FFmpeg build into the backend/ folder.
Run this once after cloning the repository.

Usage:
    python setup_ffmpeg.py
"""

import os
import sys
import zipfile
import urllib.request
import shutil

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
FFMPEG_PATH = os.path.join(BACKEND_DIR, "ffmpeg.exe")

# Full GPL build from BtbN (includes Opus, AAC, MP3, and all codecs)
FFMPEG_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
ZIP_PATH = os.path.join(BACKEND_DIR, "ffmpeg-download.zip")
TEMP_DIR = os.path.join(BACKEND_DIR, "ffmpeg-temp")


def main():
    # Check if already exists
    if os.path.exists(FFMPEG_PATH):
        print(f"[OK] ffmpeg.exe already exists at {FFMPEG_PATH}")
        print("     Delete it first if you want to re-download.")
        return

    print("[1/3] Downloading FFmpeg full build (~130MB)...")
    print(f"      URL: {FFMPEG_URL}")
    urllib.request.urlretrieve(FFMPEG_URL, ZIP_PATH)
    print("      Download complete.")

    print("[2/3] Extracting ffmpeg.exe...")
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        zf.extractall(TEMP_DIR)

    # Find ffmpeg.exe inside extracted folder
    extracted_ffmpeg = None
    for root, dirs, files in os.walk(TEMP_DIR):
        for f in files:
            if f == "ffmpeg.exe":
                extracted_ffmpeg = os.path.join(root, f)
                break
        if extracted_ffmpeg:
            break

    if not extracted_ffmpeg:
        print("[ERROR] Could not find ffmpeg.exe in the downloaded archive!")
        sys.exit(1)

    shutil.copy2(extracted_ffmpeg, FFMPEG_PATH)
    print(f"      Copied to {FFMPEG_PATH}")

    print("[3/3] Cleaning up temp files...")
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    os.remove(ZIP_PATH)

    print()
    print("=" * 50)
    print("  FFmpeg setup complete!")
    print(f"  Location: {FFMPEG_PATH}")
    print("=" * 50)


if __name__ == "__main__":
    main()
