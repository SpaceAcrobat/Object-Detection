import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename

# Your detection module
from core.detect import load_model, predict_to_file

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
OUTPUT_DIR = os.path.join(STATIC_DIR, "outputs")
MODEL_PATH = os.path.join(BASE_DIR, "model.pt")

ALLOWED_EXT = {".jpg", ".jpeg", ".png"}

# --- App ---
app = Flask(__name__, static_folder="static", template_folder="templates")

# Ensure folders exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Model (load once) ---
try:
    load_model(MODEL_PATH)
    print(f"✅ Model loaded from {MODEL_PATH}")
except Exception as e:
    print(f"❌ Failed to load model: {e}")

def allowed_file(filename: str) -> bool:
    return os.path.splitext(filename.lower())[1] in ALLOWED_EXT

# ------------------ Routes ------------------

@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/detect", methods=["POST"])
def api_detect():
    """
    Accepts form-data `image`, runs detection, writes result to /static/outputs,
    and returns JSON { output_url } for the front-end to display.
    """
    if "image" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Only .jpg, .jpeg, .png allowed"}), 400

    # Save upload
    safe_name = secure_filename(file.filename)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    upload_name = f"{ts}_{safe_name}"
    upload_path = os.path.join(UPLOAD_DIR, upload_name)
    file.save(upload_path)

    # Predict
    output_name = f"pred_{upload_name}"
    output_path = os.path.join(OUTPUT_DIR, output_name)

    try:
        predict_to_file(upload_path, output_path, weights_path=MODEL_PATH)
    except Exception as e:
        # Optional: remove bad upload to keep disk clean
        try:
            os.remove(upload_path)
        except Exception:
            pass
        return jsonify({"error": f"Detection failed: {str(e)}"}), 500

    # Public URL for front-end
    output_url = f"/static/outputs/{output_name}"
    return jsonify({"output_url": output_url})

@app.route("/static/outputs/<path:filename>")
def outputs(filename):
    # prevent directory traversal
    safe = os.path.basename(filename)
    if safe != filename:
        abort(404)
    return send_from_directory(OUTPUT_DIR, filename)

# -------------- Main --------------
if __name__ == "__main__":
    # 0.0.0.0 so you can test from phone on same Wi-Fi
    app.run(host="0.0.0.0", port=5000, debug=True)
