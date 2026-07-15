"""
model.py -- Mental Health Model Inference Module

Loads all model checkpoints and provides inference functions:
  - Phase 4: JointTwoHeadClassifier (MentalBERT backbone + Head 1 + Head 2)
             Predicts condition (5 classes) and cause (6 classes) from text.
  - Phase 5: TextMLP and AudioMLP
             Each compresses a 768-dim embedding to 128-dim intermediate features.
  - Phase 6: FusionMLP
             Concatenates text + audio features (256-dim) and predicts depression.

How .pt files work:
  A .pt file is a serialized PyTorch checkpoint containing the model's learned
  weights. torch.load() deserializes them into RAM, then load_state_dict()
  fills the matching model architecture. After that, the model sits in memory
  and processes inputs instantly (~50ms per prediction on CPU).
"""

import os
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer

# ── Configuration ──────────────────────────────────────────────────

BACKBONE_NAME = "mental/mental-bert-base-uncased"
MAX_LENGTH = 256

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_artifacts")

JOINT_CHECKPOINT = os.path.join(ARTIFACTS_DIR, "best_joint_checkpoint.pt")
TEXT_MLP_CHECKPOINT = os.path.join(ARTIFACTS_DIR, "text_mlp_checkpoint.pt")
AUDIO_MLP_CHECKPOINT = os.path.join(ARTIFACTS_DIR, "audio_mlp_checkpoint.pt")
FUSION_MLP_CHECKPOINT = os.path.join(ARTIFACTS_DIR, "fusion_mlp_checkpoint.pt")

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


# ══════════════════════════════════════════════════════════════════
#  Phase 4: Joint Two-Head Classifier
# ══════════════════════════════════════════════════════════════════

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
        self.head1_classifier = nn.Linear(self.backbone.config.hidden_size, n_head1)
        self.head2_classifier = nn.Linear(self.backbone.config.hidden_size, n_head2)

    def forward(self, input_ids, attention_mask=None):
        outputs = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
        pooled = outputs.last_hidden_state[:, 0, :]  # [CLS] token
        pooled = self.dropout(pooled)
        h1_logits = self.head1_classifier(pooled)
        h2_logits = self.head2_classifier(pooled)
        return h1_logits, h2_logits

    def get_embedding(self, input_ids, attention_mask=None):
        """Extract the 768-dim [CLS] embedding (no dropout, for fusion pipeline)."""
        with torch.no_grad():
            outputs = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
            return outputs.last_hidden_state[:, 0, :]  # (batch, 768)


# ══════════════════════════════════════════════════════════════════
#  Phase 5: Unimodal Depression MLPs (Text and Audio)
# ══════════════════════════════════════════════════════════════════

class DepressionMLP(nn.Module):
    """
    MLP that compresses a 768-dim embedding into 128-dim intermediate features.
    Also has an auxiliary head (128 -> 1) for standalone depression prediction.

    Architecture from checkpoint:
      encoder.0: Linear(768, 256) + ReLU
      encoder.3: Linear(256, 128) + ReLU
      aux_head:  Linear(128, 1)   (sigmoid for binary classification)
    """

    def __init__(self, input_dim=768, hidden_dim=256, feature_dim=128):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, feature_dim),
            nn.ReLU(),
        )
        self.aux_head = nn.Linear(feature_dim, 1)

    def forward(self, x):
        """Returns (128-dim features, auxiliary depression logit)."""
        features = self.encoder(x)
        aux_logit = self.aux_head(features)
        return features, aux_logit

    def get_features(self, x):
        """Returns just the 128-dim intermediate features (for fusion)."""
        return self.encoder(x)


# ══════════════════════════════════════════════════════════════════
#  Phase 6: Fusion MLP
# ══════════════════════════════════════════════════════════════════

class FusionMLP(nn.Module):
    """
    Fuses text (128-dim) and audio (128-dim) intermediate features.
    concat(128 + 128) = 256 -> 64 -> 1

    Architecture from checkpoint:
      net.0: Linear(256, 64) + ReLU
      net.3: Linear(64, 1)
    """

    def __init__(self, input_dim=256, hidden_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, 1),
        )

    def forward(self, text_features, audio_features):
        """
        Args:
            text_features:  (batch, 128) from TextMLP
            audio_features: (batch, 128) from AudioMLP
        Returns:
            depression logit (batch, 1)
        """
        combined = torch.cat([text_features, audio_features], dim=-1)  # (batch, 256)
        return self.net(combined)


# ══════════════════════════════════════════════════════════════════
#  Full Inference Engine
# ══════════════════════════════════════════════════════════════════

class MentalHealthPredictor:
    """
    Loads all model checkpoints and provides full inference:
      - predict(text) -> condition + cause
      - predict_depression(text_embedding, audio_embedding) -> depressed/not
      - full_assessment(text, audio_embedding) -> everything
    """

    def __init__(self, device=None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.tokenizer = None
        self.text_mlp = None
        self.audio_mlp = None
        self.fusion_mlp = None
        self.h1_labels = DEFAULT_H1_LABELS
        self.h2_labels = DEFAULT_H2_LABELS
        self.fusion_available = False
        self._load_all()

    def _load_all(self):
        """Load all models."""
        import logging
        logging.getLogger("transformers.modeling_utils").setLevel(logging.ERROR)

        hf_token = os.environ.get("HF_TOKEN")

        # ── Phase 4: Joint model ──
        if not os.path.exists(JOINT_CHECKPOINT):
            raise FileNotFoundError(
                f"Joint checkpoint not found at: {JOINT_CHECKPOINT}\n"
                f"Please place best_joint_checkpoint.pt in backend/model_artifacts/"
            )

        print(f"[Model] Loading tokenizer from {BACKBONE_NAME}...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            BACKBONE_NAME, token=hf_token, clean_up_tokenization_spaces=True
        )

        print("[Model] Building joint model architecture...")
        self.model = JointTwoHeadClassifier(
            backbone_name=BACKBONE_NAME,
            n_head1=len(DEFAULT_H1_LABELS),
            n_head2=len(DEFAULT_H2_LABELS),
        )

        print(f"[Model] Loading joint checkpoint...")
        checkpoint = torch.load(JOINT_CHECKPOINT, map_location=self.device, weights_only=False)
        self.model.load_state_dict(checkpoint["model_state_dict"])

        if "h1_label_mapping" in checkpoint and checkpoint["h1_label_mapping"]:
            self.h1_labels = {int(k): v for k, v in checkpoint["h1_label_mapping"].items()}
        if "h2_label_mapping" in checkpoint and checkpoint["h2_label_mapping"]:
            self.h2_labels = {int(k): v for k, v in checkpoint["h2_label_mapping"].items()}

        self.model.to(self.device)
        self.model.eval()

        f1 = checkpoint.get("combined_macro_f1", "?")
        print(f"[Model] OK Joint model loaded (combined_F1={f1})")

        # ── Phase 5 + 6: Depression fusion models ──
        try:
            self._load_fusion_models()
            self.fusion_available = True
            print("[Model] OK Fusion pipeline loaded successfully")
        except Exception as e:
            print(f"[Model] WARNING Fusion models not available: {e}")
            print("[Model]    Depression prediction will not be available.")

        print(f"[Model] H1 labels: {self.h1_labels}")
        print(f"[Model] H2 labels: {self.h2_labels}")
        print(f"[Model] Fusion available: {self.fusion_available}")
        print(f"[Model] Device: {self.device}")

    def _load_fusion_models(self):
        """Load Text MLP, Audio MLP, and Fusion MLP from checkpoints."""

        # Text MLP
        if not os.path.exists(TEXT_MLP_CHECKPOINT):
            raise FileNotFoundError(f"Text MLP checkpoint not found: {TEXT_MLP_CHECKPOINT}")
        self.text_mlp = DepressionMLP(input_dim=768, hidden_dim=256, feature_dim=128)
        text_ckpt = torch.load(TEXT_MLP_CHECKPOINT, map_location=self.device, weights_only=False)
        self.text_mlp.load_state_dict(text_ckpt["model_state_dict"])
        self.text_mlp.to(self.device)
        self.text_mlp.eval()
        print(f"[Model]   Text MLP loaded (dev_F1={text_ckpt.get('dev_macro_f1', '?'):.4f})")

        # Audio MLP
        if not os.path.exists(AUDIO_MLP_CHECKPOINT):
            raise FileNotFoundError(f"Audio MLP checkpoint not found: {AUDIO_MLP_CHECKPOINT}")
        self.audio_mlp = DepressionMLP(input_dim=768, hidden_dim=256, feature_dim=128)
        audio_ckpt = torch.load(AUDIO_MLP_CHECKPOINT, map_location=self.device, weights_only=False)
        self.audio_mlp.load_state_dict(audio_ckpt["model_state_dict"])
        self.audio_mlp.to(self.device)
        self.audio_mlp.eval()
        print(f"[Model]   Audio MLP loaded (dev_F1={audio_ckpt.get('dev_macro_f1', '?'):.4f})")

        # Fusion MLP
        if not os.path.exists(FUSION_MLP_CHECKPOINT):
            raise FileNotFoundError(f"Fusion MLP checkpoint not found: {FUSION_MLP_CHECKPOINT}")
        self.fusion_mlp = FusionMLP(input_dim=256, hidden_dim=64)
        fusion_ckpt = torch.load(FUSION_MLP_CHECKPOINT, map_location=self.device, weights_only=False)
        self.fusion_mlp.load_state_dict(fusion_ckpt["model_state_dict"])
        self.fusion_mlp.to(self.device)
        self.fusion_mlp.eval()
        test_metrics = fusion_ckpt.get("test_metrics", {})
        print(f"[Model]   Fusion MLP loaded (dev_F1={fusion_ckpt.get('dev_macro_f1', '?'):.4f}, "
              f"test_acc={test_metrics.get('accuracy', '?')})")

    # ── Text Prediction (Phase 4) ──

    def predict(self, text: str) -> dict:
        """Predict condition and cause from text."""
        inputs = self.tokenizer(
            text, max_length=MAX_LENGTH, truncation=True,
            padding="max_length", return_tensors="pt",
        )
        input_ids = inputs["input_ids"].to(self.device)
        attention_mask = inputs["attention_mask"].to(self.device)

        with torch.no_grad():
            h1_logits, h2_logits = self.model(input_ids, attention_mask)

        h1_probs = F.softmax(h1_logits, dim=-1).squeeze().cpu()
        h2_probs = F.softmax(h2_logits, dim=-1).squeeze().cpu()

        h1_idx = h1_probs.argmax().item()
        h2_idx = h2_probs.argmax().item()

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

    # ── Text Embedding Extraction (for fusion) ──

    def get_text_embedding(self, text: str) -> torch.Tensor:
        """Extract the 768-dim CLS embedding from the joint backbone."""
        inputs = self.tokenizer(
            text, max_length=MAX_LENGTH, truncation=True,
            padding="max_length", return_tensors="pt",
        )
        input_ids = inputs["input_ids"].to(self.device)
        attention_mask = inputs["attention_mask"].to(self.device)
        return self.model.get_embedding(input_ids, attention_mask)  # (1, 768)

    # ── Depression Fusion (Phase 5 + 6) ──

    def predict_depression(self, text_embedding: torch.Tensor, audio_embedding: torch.Tensor) -> dict:
        """
        Predict depression from text and audio embeddings using the fusion pipeline.

        Args:
            text_embedding:  (1, 768) tensor from joint backbone
            audio_embedding: (1, 768) tensor from wav2vec2

        Returns:
            dict with depression prediction, confidence, and risk level.
        """
        if not self.fusion_available:
            return {
                "depression_prediction": None,
                "depression_confidence": None,
                "depression_risk": None,
                "warning": "Fusion models not loaded",
            }

        with torch.no_grad():
            text_features = self.text_mlp.get_features(text_embedding)    # (1, 128)
            audio_features = self.audio_mlp.get_features(audio_embedding)  # (1, 128)
            fusion_logit = self.fusion_mlp(text_features, audio_features)  # (1, 1)
            prob = torch.sigmoid(fusion_logit).squeeze().item()

        is_depressed = prob >= 0.5
        label = "Depressed" if is_depressed else "Not Depressed"

        # Risk level based on probability
        if prob >= 0.75:
            risk = "high"
        elif prob >= 0.5:
            risk = "moderate"
        elif prob >= 0.3:
            risk = "low"
        else:
            risk = "minimal"

        return {
            "depression_prediction": label,
            "depression_confidence": round(prob, 4),
            "depression_risk": risk,
        }

    # ── Full Assessment (all phases combined) ──

    def full_assessment(self, text: str, audio_embedding_np: np.ndarray = None) -> dict:
        """
        Run the complete assessment pipeline:
          1. Predict condition + cause from text (Phase 4)
          2. Extract text embedding from the joint backbone
          3. If audio embedding is provided, run the fusion pipeline (Phase 5+6)

        Args:
            text: transcript string
            audio_embedding_np: optional numpy array of shape (768,) from wav2vec2

        Returns:
            Combined dict with all predictions.
        """
        # Phase 4: condition + cause
        result = self.predict(text)

        # Phase 5+6: depression (if audio is available and fusion is loaded)
        if audio_embedding_np is not None and self.fusion_available:
            text_emb = self.get_text_embedding(text)  # (1, 768)
            audio_emb = torch.tensor(audio_embedding_np, dtype=torch.float32).unsqueeze(0).to(self.device)  # (1, 768)
            depression = self.predict_depression(text_emb, audio_emb)
            result.update(depression)
        else:
            result["depression_prediction"] = None
            result["depression_confidence"] = None
            result["depression_risk"] = None
            if audio_embedding_np is None:
                result["depression_note"] = "No audio embedding provided - depression prediction requires audio"
            elif not self.fusion_available:
                result["depression_note"] = "Fusion models not loaded"

        return result

    def predict_batch(self, texts: list[str]) -> list[dict]:
        """Predict condition and cause for multiple texts."""
        return [self.predict(text) for text in texts]
