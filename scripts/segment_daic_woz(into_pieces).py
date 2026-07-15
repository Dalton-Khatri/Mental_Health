"""
E-DAIC segmentation pipeline for MIL (Wav2Vec2 + MentalBERT) training.

Dataset layout expected:
    D:\\EDAIC\\<ID>_P\\<ID>_P\\<ID>_AUDIO.wav
    D:\\EDAIC\\<ID>_P\\<ID>_P\\<ID>_Transcript.csv   (participant-only, Ellie removed)

Output layout produced:
    D:\\EDAIC\\processed_segments\\<ID>\\segment001.wav
    D:\\EDAIC\\processed_segments\\<ID>\\segment001.txt
    D:\\EDAIC\\processed_segments\\<ID>\\segment002.wav
    ...
    D:\\EDAIC\\processed_segments\\<ID>\\manifest.json

Segmentation philosophy
------------------------
The transcript already has Ellie removed, so consecutive participant rows can
look topically disconnected even when they're one continuous answer (Ellie's
question sat in the gap). Because of that, segmentation here is driven
PRIMARILY by target duration/word-count and gap size, not by sentence
similarity. Semantic similarity is only consulted as a secondary heuristic,
at candidate boundaries, once the segment already satisfies its minimum
targets -- to decide whether the participant is still continuing the same
train of thought (merge through the gap) or has moved to a clearly different
topic (cut here).

Segment audio duration = sum of the individual participant utterance
durations that were merged into it (i.e. the actual concatenated audio you
get after stripping out Ellie/silence), not wall-clock span.

Requirements:
    pip install pandas librosa soundfile tqdm
    pip install sentence-transformers   # optional, enables the secondary
                                         # semantic heuristic; pipeline still
                                         # works without it (falls back to
                                         # pure gap/duration/word logic)
"""

import os
import re
import json
import argparse
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
import librosa
import soundfile as sf
from tqdm import tqdm


# ============================================================
# Config
# ============================================================

@dataclass
class SegmentConfig:
    min_duration: float = 40.0          # seconds of participant speech
    target_max_duration: float = 60.0
    hard_max_duration: float = 90.0

    min_words: int = 50
    target_max_words: int = 120
    hard_max_words: int = 180

    gap_boundary_threshold: float = 3.0  # gap (s) between utterances that
                                          # counts as a "candidate boundary"
                                          # (likely Ellie spoke in between)

    use_semantic_secondary: bool = True
    semantic_continuation_threshold: float = 0.28  # cosine sim above this
                                                     # -> treat as same thought,
                                                     # keep merging past a gap
    semantic_model_name: str = "all-MiniLM-L6-v2"

    min_confidence: float = None         # optional ASR confidence filter


TARGET_SR = 16000


# ============================================================
# Transcript loading / cleaning
# ============================================================

def load_transcript(csv_path, cfg: SegmentConfig):
    df = pd.read_csv(csv_path)
    df.columns = [c.strip().lower() for c in df.columns]

    required = {"start_time", "end_time", "text"}
    missing = required - set(df.columns)
    if missing:
        print(f"Skipping {csv_path} - missing columns: {missing}")
        return None

    df["text"] = df["text"].astype(str).str.strip()
    df = df[(df["text"] != "") & (df["text"].str.lower() != "nan")].reset_index(drop=True)

    if cfg.min_confidence is not None and "confidence" in df.columns:
        before = len(df)
        df = df[df["confidence"].astype(float) >= cfg.min_confidence].reset_index(drop=True)
        print(f"  confidence filter >= {cfg.min_confidence}: kept {len(df)}/{before} rows")

    return df


def clean_text(raw_text: str) -> str:
    text = raw_text.strip()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def word_count(text: str) -> int:
    return len(text.split())


# ============================================================
# Optional semantic secondary heuristic
# ============================================================

class SemanticScorer:
    """
    Lazily-loaded sentence-embedding scorer used ONLY as a secondary signal
    at candidate boundaries after minimum targets are already met.
    Falls back to always-cut behavior if sentence-transformers isn't
    installed, so the pipeline never hard-depends on it.
    """

    def __init__(self, cfg: SegmentConfig):
        self.enabled = cfg.use_semantic_secondary
        self.model = None
        if self.enabled:
            try:
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer(cfg.semantic_model_name)
            except Exception as e:
                print(f"[semantic] Could not load sentence-transformers ({e}). "
                      f"Falling back to gap/duration-only segmentation.")
                self.enabled = False

    def is_continuation(self, prev_text: str, next_text: str, threshold: float) -> bool:
        if not self.enabled or self.model is None:
            return False
        emb = self.model.encode([prev_text, next_text], normalize_embeddings=True)
        sim = float(np.dot(emb[0], emb[1]))
        return sim >= threshold


# ============================================================
# Core segmentation logic
# ============================================================

@dataclass
class Utterance:
    start: float
    end: float
    text: str


@dataclass
class Segment:
    utterances: list = field(default_factory=list)

    @property
    def speech_duration(self):
        return sum(u.end - u.start for u in self.utterances)

    @property
    def word_count(self):
        return sum(word_count(u.text) for u in self.utterances)

    @property
    def text(self):
        return " ".join(clean_text(u.text) for u in self.utterances)

    @property
    def start_time(self):
        return self.utterances[0].start

    @property
    def end_time(self):
        return self.utterances[-1].end

    def meets_min(self, cfg: SegmentConfig):
        return self.speech_duration >= cfg.min_duration and self.word_count >= cfg.min_words

    def exceeds_hard_max(self, cfg: SegmentConfig):
        return self.speech_duration >= cfg.hard_max_duration or self.word_count >= cfg.hard_max_words

    def within_target(self, cfg: SegmentConfig):
        return (cfg.min_duration <= self.speech_duration <= cfg.target_max_duration and
                cfg.min_words <= self.word_count <= cfg.target_max_words)


def build_segments(df: pd.DataFrame, cfg: SegmentConfig, scorer: SemanticScorer):
    """
    Greedy, target-driven turn segmentation.

    - Always keep merging utterances until BOTH min_duration and min_words
      are satisfied, regardless of gap size (a segment is never cut early
      just because Ellie's turn created a gap).
    - Once minimums are met, a large gap becomes a "candidate boundary":
        * if a semantic scorer is available and judges the next utterance a
          continuation of the same thought, keep merging past the gap
          (up to target_max, then hard_max).
        * otherwise, cut here.
    - A hard ceiling always forces a cut regardless of semantics, to avoid
      runaway segments.
    - Any leftover tail that doesn't meet minimums gets merged into the
      previous segment (unless that would blow the hard ceiling, in which
      case it's kept as its own final segment anyway -- a slightly-under
      final segment beats an excessively long one).
    """
    utterances = [
        Utterance(float(r["start_time"]), float(r["end_time"]), r["text"])
        for _, r in df.iterrows()
    ]

    segments = []
    current = Segment()
    prev_end = None

    for utt in utterances:
        gap = (utt.start - prev_end) if prev_end is not None else 0.0

        if not current.utterances:
            current.utterances.append(utt)
            prev_end = utt.end
            continue

        candidate_boundary = gap > cfg.gap_boundary_threshold

        if current.exceeds_hard_max(cfg):
            # force cut regardless of anything else
            segments.append(current)
            current = Segment(utterances=[utt])

        elif current.meets_min(cfg) and candidate_boundary:
            continuation = scorer.is_continuation(
                current.text, clean_text(utt.text), cfg.semantic_continuation_threshold
            )
            if continuation and not current.within_target(cfg) is False:
                # still room to grow toward/within target -> merge through the gap
                current.utterances.append(utt)
            elif continuation and current.speech_duration < cfg.hard_max_duration \
                    and current.word_count < cfg.hard_max_words:
                # allow growth past target but under hard cap if genuinely continuing
                current.utterances.append(utt)
            else:
                segments.append(current)
                current = Segment(utterances=[utt])
        else:
            # either minimums not met yet, or gap is small -> keep merging
            current.utterances.append(utt)

        prev_end = utt.end

    if current.utterances:
        if segments and not current.meets_min(cfg):
            prev_seg = segments[-1]
            merged_duration = prev_seg.speech_duration + current.speech_duration
            merged_words = prev_seg.word_count + current.word_count
            if merged_duration < cfg.hard_max_duration and merged_words < cfg.hard_max_words:
                prev_seg.utterances.extend(current.utterances)
            else:
                segments.append(current)
        else:
            segments.append(current)

    return segments


# ============================================================
# Audio slicing (participant-only, Ellie never included)
# ============================================================

def slice_and_concatenate(audio: np.ndarray, sr: int, segment: Segment) -> np.ndarray:
    pieces = []
    for utt in segment.utterances:
        start_sample = int(utt.start * sr)
        end_sample = min(int(utt.end * sr), len(audio))
        if start_sample < end_sample:
            pieces.append(audio[start_sample:end_sample])
    if not pieces:
        return np.array([], dtype=np.float32)
    return np.concatenate(pieces)


# ============================================================
# Per-participant processing
# ============================================================

def find_participants(root: Path):
    for outer in sorted(root.glob("*_P")):
        if not outer.is_dir():
            continue
        pid = outer.name.replace("_P", "")
        inner = outer / outer.name
        if not inner.is_dir():
            inner = outer

        transcript_path = inner / f"{pid}_Transcript.csv"
        audio_path = inner / f"{pid}_AUDIO.wav"

        if transcript_path.exists() and audio_path.exists():
            yield pid, transcript_path, audio_path
        else:
            print(f"[skip] {pid}: missing "
                  f"{'transcript ' if not transcript_path.exists() else ''}"
                  f"{'audio' if not audio_path.exists() else ''} in {inner}")


def process_participant(pid, transcript_path, audio_path, out_root: Path,
                         cfg: SegmentConfig, scorer: SemanticScorer, preview: bool):
    df = load_transcript(transcript_path, cfg)
    if df is None or df.empty:
        print(f"[{pid}] no usable transcript rows, skipping.")
        return

    segments = build_segments(df, cfg, scorer)
    if not segments:
        print(f"[{pid}] no segments produced, skipping.")
        return

    print(f"[{pid}] {len(segments)} segments:")
    for i, seg in enumerate(segments, 1):
        print(f"    segment{i:03d}: dur={seg.speech_duration:5.1f}s "
              f"words={seg.word_count:3d} n_utt={len(seg.utterances):2d} "
              f"span={seg.start_time:.1f}-{seg.end_time:.1f}")

    if preview:
        return  # dry run -- no files written

    audio, sr = librosa.load(str(audio_path), sr=TARGET_SR, mono=True)

    out_dir = out_root / pid
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    for i, seg in enumerate(segments, 1):
        seg_audio = slice_and_concatenate(audio, sr, seg)
        if seg_audio.size == 0:
            continue

        seg_name = f"segment{i:03d}"
        wav_path = out_dir / f"{seg_name}.wav"
        txt_path = out_dir / f"{seg_name}.txt"

        sf.write(str(wav_path), seg_audio, TARGET_SR)
        with open(txt_path, "w", encoding="utf8") as f:
            f.write(seg.text)

        manifest.append({
            "participant_id": pid,
            "segment_id": i,
            "segment_name": seg_name,
            "start_time": seg.start_time,
            "end_time": seg.end_time,
            "speech_duration_sec": round(seg.speech_duration, 2),
            "word_count": seg.word_count,
            "n_utterances": len(seg.utterances),
            "text": seg.text,
            "audio_file": f"{seg_name}.wav",
            "text_file": f"{seg_name}.txt",
        })

    with open(out_dir / "manifest.json", "w", encoding="utf8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"[{pid}] wrote {len(manifest)} segment files -> {out_dir}")

def parse_participant_list(spec):
    """
    Convert strings like:
        600
        600,601,602
        600-605
        600-605,610,615-620

    into:
        {"600","601","602",...}
    """
    if spec is None:
        return None

    ids = set()

    for part in spec.split(","):
        part = part.strip()

        if not part:
            continue

        if "-" in part:
            start, end = part.split("-", 1)
            start = int(start)
            end = int(end)

            if start > end:
                start, end = end, start

            for pid in range(start, end + 1):
                ids.add(str(pid))
        else:
            ids.add(str(int(part)))

    return ids
# ============================================================
# CLI / batch driver
# ============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=r"D:\EDAIC", help="EDAIC root folder")
    parser.add_argument("--out_dir", default=None,
                         help=r'Output folder (default: <root>\processed_segments)')
    parser.add_argument(
    "--participants",
    "--ids",
    dest="participants",
    default=None,
    help=(
        "Participants to process. "
        "Examples: 600,601,602 or 600-605 or 600-605,610,615-620"
    ),
    )
    parser.add_argument("--preview", action="store_true",
                         help="Dry run: print planned segments, write nothing to disk")
    parser.add_argument("--min_confidence", type=float, default=None)

    parser.add_argument("--min_duration", type=float, default=40.0)
    parser.add_argument("--target_max_duration", type=float, default=60.0)
    parser.add_argument("--hard_max_duration", type=float, default=90.0)
    parser.add_argument("--min_words", type=int, default=50)
    parser.add_argument("--target_max_words", type=int, default=120)
    parser.add_argument("--hard_max_words", type=int, default=180)
    parser.add_argument("--gap_threshold", type=float, default=3.0)
    parser.add_argument("--disable_semantic", action="store_true",
                         help="Disable the secondary semantic-similarity heuristic")
    parser.add_argument("--semantic_threshold", type=float, default=0.28)

    args = parser.parse_args()

    root = Path(args.root)
    if not root.is_dir():
        raise SystemExit(f"Root folder not found: {root}")

    out_root = Path(args.out_dir) if args.out_dir else root / "processed_segments"

    cfg = SegmentConfig(
        min_duration=args.min_duration,
        target_max_duration=args.target_max_duration,
        hard_max_duration=args.hard_max_duration,
        min_words=args.min_words,
        target_max_words=args.target_max_words,
        hard_max_words=args.hard_max_words,
        gap_boundary_threshold=args.gap_threshold,
        use_semantic_secondary=not args.disable_semantic,
        semantic_continuation_threshold=args.semantic_threshold,
        min_confidence=args.min_confidence,
    )

    scorer = SemanticScorer(cfg)

    wanted_ids = parse_participant_list(args.participants)

    participants = list(find_participants(root))
    if wanted_ids is not None:
        participants = [p for p in participants if p[0] in wanted_ids]

    for pid, transcript_path, audio_path in tqdm(participants):
        process_participant(pid, transcript_path, audio_path, out_root, cfg, scorer, args.preview)

    print("Finished!" + (" (preview mode - nothing written)" if args.preview else ""))


if __name__ == "__main__":
    main()



# python segment_daic_woz.py --participants 600-605 