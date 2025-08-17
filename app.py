import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename

from core.detect import load_model, predict_to_file

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
OUTPUT_DIR = os.path.join(STATIC_DIR, "outputs")
MODEL_PATH = os.path.join(BASE_DIR, "model.pt")

# --- App ---
app = Flask(__name__, static_folder="static", template_folder="templates")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load model once at startup
load_model(MODEL_PATH)

ALLOWED_EXT = {".jpg", ".jpeg", ".png"}

def allowed_file(filename):
    return os.path.splitext(filename.lower())[1] in ALLOWED_EXT

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/detect", methods=["POST"])
def api_detect():
    if "image" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Only .jpg, .jpeg, .png allowed"}), 400

    # Save upload
    filename = secure_filename(file.filename)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    upload_name = f"{ts}_{filename}"
    upload_path = os.path.join(UPLOAD_DIR, upload_name)
    file.save(upload_path)

    # Run detection -> save to outputs
    output_name = f"pred_{upload_name}"
    output_path = os.path.join(OUTPUT_DIR, output_name)
    try:
        predict_to_file(upload_path, output_path, weights_path=MODEL_PATH)
    except Exception as e:
        return jsonify({"error": f"Detection failed: {str(e)}"}), 500

    output_url = f"/static/outputs/{output_name}"
    return jsonify({"output_url": output_url})

@app.route("/static/outputs/<path:filename>")
def outputs(filename):
    safe = os.path.basename(filename)
    if safe != filename:
        abort(404)
    return send_from_directory(OUTPUT_DIR, filename)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
