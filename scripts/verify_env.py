"""
verify_env.py

WHAT THIS SCRIPT DOES
----------------------
A one-time sanity check you run after setting up your Python environment.
It confirms that all the libraries we need (torch, transformers, datasets,
scikit-learn, pandas) are installed correctly, checks whether you have a
GPU available, and then tries to actually load MentalBERT and run one
dummy sentence through it -- just to prove the whole chain works before
anyone starts real training.

It does NOT train anything. It does NOT touch the project datasets.
It's purely a "is my machine ready" check.

HUGGING FACE TOKEN -- READ THIS BEFORE RUNNING
------------------------------------------------
MentalBERT (mental/mental-bert-base-uncased) is a "gated" model on
Hugging Face. That means everyone on the team has to individually:

  1. Make a free account at https://huggingface.co
  2. Go to https://huggingface.co/mental/mental-bert-base-uncased
     while logged in, and click "Agree" on the usage conditions.
  3. Create a personal access token at
     https://huggingface.co/settings/tokens (Read access is enough).
  4. Set that token as an environment variable BEFORE running this
     script (do this every new terminal session, or set it permanently
     in your system environment variables):

         Windows (PowerShell):
             $env:HF_TOKEN = "your_token_here"

         Mac/Linux:
             export HF_TOKEN="your_token_here"

DO NOT paste your token directly into this file, and do not commit a
token to the repo. Each person's acceptance + token is tied to their
own Hugging Face account -- tokens can't be shared the way code can.

If you haven't done the steps above yet (or your gated access hasn't
been approved), this script will automatically fall back to a public
model (bert-base-uncased) so you can still confirm everything else
works. Swap back to MentalBERT once your access is active.
"""

import os
import sys
import getpass


def check_libraries():
    """Make sure every library the project depends on actually imports."""
    print("=" * 50)
    print("STEP 1: Checking installed libraries")
    print("=" * 50)
    try:
        import torch
        import transformers
        import datasets
        import sklearn
        import pandas as pd
    except ImportError as e:
        print(f"[FAILED] A required library is missing: {e}")
        input("\nPress Enter to exit...")
        sys.exit(1)

    print("[OK] torch, transformers, datasets, scikit-learn, pandas all imported fine.")
    print(f"     Python version:       {sys.version.split()[0]}")
    print(f"     PyTorch version:      {torch.__version__}")
    print(f"     Transformers version: {transformers.__version__}")
    print(f"     Datasets version:     {datasets.__version__}")
    print(f"     Scikit-learn version: {sklearn.__version__}")
    print(f"     Pandas version:       {pd.__version__}")
    return torch


def check_hardware(torch):
    """Report whether we're running on CPU or GPU. CPU is fine for this check."""
    print("\n" + "=" * 50)
    print("STEP 2: Checking hardware")
    print("=" * 50)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[INFO] Running on: {device.type.upper()}")

    if device.type == "cuda":
        print(f"       GPU detected: {torch.cuda.get_device_name(0)}")
    else:
        print("       No GPU detected -- that's OK for today.")
        print("       This script only runs one tiny test sentence through")
        print("       the model, which CPU handles instantly. GPU only")
        print("       starts to matter once we begin real training on the")
        print("       full datasets (that's a later step, not today's).")
    return device


def get_hf_token():
    """
    Look for a Hugging Face token in the environment.
    If it's not set, ask for it once (input hidden where possible)
    rather than forcing everyone to fight with `hf auth login`.
    """
    token = os.environ.get("HF_TOKEN")
    if token:
        return token

    print("\n[INFO] No HF_TOKEN environment variable found.")
    print("       If you've already accepted MentalBERT's license and have")
    print("       a token, you can paste it now. Otherwise just press Enter")
    print("       and the script will fall back to a public model instead.")
    try:
        token = getpass.getpass("HF token (or press Enter to skip): ").strip()
    except Exception:
        token = input("HF token (or press Enter to skip): ").strip()

    return token or None


def load_model(model_name, device, token=None):
    """Try to load a tokenizer + model pair. Raises if it fails."""
    from transformers import AutoTokenizer, AutoModel
    tokenizer = AutoTokenizer.from_pretrained(model_name, token=token)
    model = AutoModel.from_pretrained(model_name, token=token).to(device)
    return tokenizer, model


def run_dummy_forward_pass(device, token):
    """
    The actual point of this script: load MentalBERT (or fall back to a
    public model if gated access isn't ready yet) and push one sentence
    through it, just to prove the full pipeline works end to end.
    """
    print("\n" + "=" * 50)
    print("STEP 3: Loading the text model and testing it")
    print("=" * 50)

    primary_model = "mental/mental-bert-base-uncased"
    fallback_model = "bert-base-uncased"

    print(f"[INFO] Trying primary model: {primary_model}")
    try:
        tokenizer, model = load_model(primary_model, device, token=token)
        used_model = primary_model
        print(f"[OK] Loaded {primary_model} successfully.")
    except Exception as e:
        print(f"[FAILED] Could not load {primary_model}.")
        print(f"         Reason: {e}")
        print(f"\n[INFO] Falling back to '{fallback_model}' so we can still")
        print("       confirm the rest of the setup works today. Re-run")
        print("       this script later once MentalBERT access is approved.")
        try:
            tokenizer, model = load_model(fallback_model, device)
            used_model = fallback_model
            print(f"[OK] Loaded fallback model {fallback_model} successfully.")
        except Exception as e2:
            print(f"[FAILED] Fallback model also failed to load: {e2}")
            input("\nPress Enter to exit...")
            sys.exit(1)

    # Push one test sentence through the model. We don't care about the
    # content, only that the model runs without errors and returns
    # something shaped the way we expect.
    test_sentence = "Checking that the environment and model are set up correctly."
    inputs = tokenizer(test_sentence, return_tensors="pt", padding=True, truncation=True, max_length=512)
    inputs = {key: value.to(device) for key, value in inputs.items()}

    import torch
    with torch.no_grad():
        outputs = model(**inputs)

    print("[OK] Test sentence processed successfully.")
    print(f"     Model used:    {used_model}")
    print(f"     Output shape:  {list(outputs.last_hidden_state.shape)}")
    print("     (This is [batch_size, num_tokens, embedding_size] -- looks right.)")

    print("\n" + "=" * 50)
    if used_model == primary_model:
        print("ALL GOOD -- environment is fully verified with MentalBERT.")
    else:
        print("PARTIALLY GOOD -- environment works, but using the fallback model.")
        print("Set HF_TOKEN and re-run once MentalBERT access clears.")
    print("=" * 50)


def main():
    torch = check_libraries()
    device = check_hardware(torch)
    token = get_hf_token()
    run_dummy_forward_pass(device, token)
    input("\nDone. Press Enter to close this window...")


if __name__ == "__main__":
    main()