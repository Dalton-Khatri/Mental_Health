"""
model.py — Mental Health Model Inference Module

Loads the Phase 4 joint checkpoint (MentalBERT backbone + Head 1 + Head 2)
and provides functions to predict condition and cause from text.

How .pt files work:
  A .pt file is a serialized PyTorch checkpoint. It contains a Python dict
  with the model's learned weights (millions of numbers/tensors). When we
  call torch.load(), it deserializes those tensors back into memory. We
  then create the same model architecture (JointTwoHeadClassifier) and
  fill it with those saved weights using load_state_dict(). After that,
  the model lives in RAM and can process text inputs instantly — no
  internet or GPU needed for inference.
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer

# ── Configuration ──────────────────────────────────────────────────

BACKBONE_NAME = "mental/mental-bert-base-uncased"
MAX_LENGTH = 256

CHECKPOINT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "model_artifacts",
    "best_joint_checkpoint.pt",
)

# Default label mappings (overridden by checkpoint if available)
DEFAULT_H1_LABELS = {
    0: "Normal",
    1: "Depression",
    2: "Anxiety",
    3: "Stress",
    4: "Suicidal",
}
DEFAULT_H2_LABELS = {
    0: "No reason",
    1: "Bias or abuse",
    2: "Jobs and careers",
    3: "Medication",
    4: "Relationship",
    5: "Alienation",
}


# ── Model Definition ──────────────────────────────────────────────
# Must match the architecture used during Phase 4 training exactly.

class JointTwoHeadClassifier(nn.Module):
    """
    Shared MentalBERT backbone with two classification heads.
    Head 1: Condition (5 classes)
    Head 2: Cause (6 classes)
    """

    def __init__(self, backbone_name, n_head1=5, n_head2=6, dropout=0.1):
        super().__init__()
        self.backbone = AutoModel.from_pretrained(backbone_name)
        self.dropout = nn.Dropout(dropout)
        # Names must match the checkpoint: head1_classifier, head2_classifier
        self.head1_classifier = nn.Linear(self.backbone.config.hidden_size, n_head1)
        self.head2_classifier = nn.Linear(self.backbone.config.hidden_size, n_head2)

    def forward(self, input_ids, attention_mask=None):
        outputs = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
        pooled = outputs.last_hidden_state[:, 0, :]  # [CLS] token
        pooled = self.dropout(pooled)
        h1_logits = self.head1_classifier(pooled)
        h2_logits = self.head2_classifier(pooled)
        return h1_logits, h2_logits


# ── Inference Engine ──────────────────────────────────────────────

class MentalHealthPredictor:
    """
    Loads the Phase 4 checkpoint once and provides predict() for inference.

    Usage:
        predictor = MentalHealthPredictor()   # loads model (~10-20 sec first time)
        result = predictor.predict("I feel so anxious about everything")
        # result = {
        #   "condition": "Anxiety",
        #   "condition_confidence": 0.87,
        #   "condition_scores": {"Normal": 0.03, "Depression": 0.05, ...},
        #   "cause": "Jobs and careers",
        #   "cause_confidence": 0.62,
        #   "cause_scores": {"No reason": 0.1, ...},
        # }
    """

    def __init__(self, checkpoint_path=CHECKPOINT_PATH, device=None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.tokenizer = None
        self.h1_labels = DEFAULT_H1_LABELS
        self.h2_labels = DEFAULT_H2_LABELS
        self._load(checkpoint_path)

    def _load(self, checkpoint_path):
        """Load tokenizer, model architecture, and checkpoint weights."""

        if not os.path.exists(checkpoint_path):
            raise FileNotFoundError(
                f"Checkpoint not found at: {checkpoint_path}\n"
                f"Please place best_joint_checkpoint.pt in backend/model_artifacts/"
            )

        print(f"[Model] Loading tokenizer from {BACKBONE_NAME}...")
        hf_token = os.environ.get("HF_TOKEN")
        self.tokenizer = AutoTokenizer.from_pretrained(
            BACKBONE_NAME, token=hf_token, clean_up_tokenization_spaces=True
        )

        import logging
        logging.getLogger("transformers.modeling_utils").setLevel(logging.ERROR)
        print(f"[Model] Building model architecture...")
        self.model = JointTwoHeadClassifier(
            backbone_name=BACKBONE_NAME,
            n_head1=len(DEFAULT_H1_LABELS),
            n_head2=len(DEFAULT_H2_LABELS),
        )

        print(f"[Model] Loading checkpoint from {checkpoint_path}...")
        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)

        # Load fine-tuned weights (overwrites the pretrained weights)
        self.model.load_state_dict(checkpoint["model_state_dict"])

        # Load label mappings from checkpoint if available
        if "h1_label_mapping" in checkpoint and checkpoint["h1_label_mapping"]:
            self.h1_labels = {int(k): v for k, v in checkpoint["h1_label_mapping"].items()}
        if "h2_label_mapping" in checkpoint and checkpoint["h2_label_mapping"]:
            self.h2_labels = {int(k): v for k, v in checkpoint["h2_label_mapping"].items()}

        self.model.to(self.device)
        self.model.eval()

        epoch = checkpoint.get("epoch", "?")
        f1 = checkpoint.get("combined_macro_f1", "?")
        print(f"[Model] OK Loaded successfully! (epoch={epoch}, combined_F1={f1})")
        print(f"[Model] H1 labels: {self.h1_labels}")
        print(f"[Model] H2 labels: {self.h2_labels}")
        print(f"[Model] Device: {self.device}")

    def predict(self, text: str) -> dict:
        """
        Predict condition and cause from a single text string.

        Returns dict with condition, cause, confidence scores, and
        per-class probability distributions.
        """
        # Tokenize
        inputs = self.tokenizer(
            text,
            max_length=MAX_LENGTH,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )
        input_ids = inputs["input_ids"].to(self.device)
        attention_mask = inputs["attention_mask"].to(self.device)

        # Forward pass (no gradient computation needed for inference)
        with torch.no_grad():
            h1_logits, h2_logits = self.model(input_ids, attention_mask)

        # Convert logits to probabilities
        h1_probs = F.softmax(h1_logits, dim=-1).squeeze().cpu()
        h2_probs = F.softmax(h2_logits, dim=-1).squeeze().cpu()

        # Get top predictions
        h1_idx = h1_probs.argmax().item()
        h2_idx = h2_probs.argmax().item()

        # Build per-class score dicts
        h1_scores = {self.h1_labels[i]: round(h1_probs[i].item(), 4) for i in range(len(self.h1_labels))}
        h2_scores = {self.h2_labels[i]: round(h2_probs[i].item(), 4) for i in range(len(self.h2_labels))}

        return {
            "condition": self.h1_labels[h1_idx],
            "condition_confidence": round(h1_probs[h1_idx].item(), 4),
            "condition_scores": h1_scores,
            "cause": self.h2_labels[h2_idx],
            "cause_confidence": round(h2_probs[h2_idx].item(), 4),
            "cause_scores": h2_scores,
        }

    def predict_batch(self, texts: list[str]) -> list[dict]:
        """Predict condition and cause for multiple texts."""
        return [self.predict(text) for text in texts]
