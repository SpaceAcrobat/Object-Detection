"""
Minimal detection helpers for Flask:
Works with YOLOv5 custom weights.
"""

import os
from pathlib import Path
from typing import Optional

import torch
import cv2

_MODEL = None
_DEVICE = None


def _select_device():
    """Pick CUDA if available, otherwise CPU (once)."""
    global _DEVICE
    if _DEVICE is None:
        _DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return _DEVICE


def load_model(weights_path: str):
    """Load YOLOv5 model using torch.hub and cache it."""
    global _MODEL
    weights_path = Path(weights_path)

    if not weights_path.exists():
        raise FileNotFoundError(f"Model weights not found: {weights_path}")

    if _MODEL is not None:
        return _MODEL  # already loaded

    device = _select_device()
    _MODEL = torch.hub.load(
        "ultralytics/yolov5",  # this fetches YOLOv5 repo
        "custom",
        path=str(weights_path),
        source="github",       # make sure it pulls from github
        force_reload=False,
        trust_repo=True
    )
    _MODEL.to(device).eval()
    return _MODEL


def predict_to_file(input_path: str, output_path: str, weights_path: Optional[str] = None) -> str:
    """Run detection on an image and save the annotated image."""
    global _MODEL
    input_p = Path(input_path)
    if not input_p.exists():
        raise FileNotFoundError(f"Input image not found: {input_p}")

    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    if _MODEL is None:
        if not weights_path:
            raise RuntimeError("Model not loaded yet and no weights_path provided.")
        load_model(weights_path)

    results = _MODEL(str(input_p))
    results.render()

    img_bgr = results.ims[0] if hasattr(results, "ims") else results.imgs[0]

    if out_p.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
        out_p = out_p.with_suffix(".jpg")

    ok = cv2.imwrite(str(out_p), img_bgr)
    if not ok:
        raise IOError(f"Failed to write result image to {out_p}")

    return str(out_p)
