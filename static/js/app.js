document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const dropArea = document.getElementById("dropArea");
  const imageInput = document.getElementById("imageInput");
  const uploaderText = document.getElementById("uploaderText");
  const detectBtn = document.getElementById("detectBtn");
  const startWebcamBtn = document.getElementById("startWebcamBtn");
  const stopWebcamBtn = document.getElementById("stopWebcamBtn");
  const previewImg = document.getElementById("preview");
  const webcam = document.getElementById("webcam");
  const resultImg = document.getElementById("result");
  const loader = document.getElementById("loader");
  const statusText = document.getElementById("statusText");
  const downloadBtn = document.getElementById("downloadBtn");
  const themeToggle = document.getElementById("themeToggle");
  const fpsEl = document.getElementById("fps");
  const latencyEl = document.getElementById("latency");
  const toasts = document.getElementById("toasts");

  let selectedFile = null;
  let webcamStream = null;
  let webcamInterval = null;
  let inFlight = false;
  let lastTick = performance.now();
  let abortCtrl = null;

  // --- UI helpers
  const toast = (msg, type="") => {
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.textContent = msg;
    toasts.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  };
  const setStatus = (txt) => statusText.textContent = txt;

  // --- File handling
  function handleFile(file){
    if (!file || !file.type?.startsWith("image/")) {
      toast("Please select a valid image (.jpg/.jpeg/.png)", "error");
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => previewImg.src = e.target.result;
    reader.readAsDataURL(file);
    uploaderText.textContent = `Selected: ${file.name}`;
    detectBtn.disabled = false;
    downloadBtn.disabled = true;
    resultImg.src = "";
    setStatus("Ready to detect.");
    stopWebcam();
  }

  dropArea.addEventListener("click", () => imageInput.click());
  dropArea.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") imageInput.click(); });
  imageInput.addEventListener("change", e => handleFile(e.target.files[0]));
  ["dragover","dragleave","drop"].forEach(ev=>{
    dropArea.addEventListener(ev, e => {
      e.preventDefault();
      if (ev === "dragover") dropArea.classList.add("drag-over");
      else dropArea.classList.remove("drag-over");
      if (ev === "drop") handleFile(e.dataTransfer.files[0]);
    });
  });

  // --- Detection
  detectBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!selectedFile) return toast("Choose an image first", "error");
    await detectWithBlob(selectedFile);
  });

  async function detectWithBlob(blob){
    if (inFlight) return;
    inFlight = true;
    loader.classList.remove("hidden");
    detectBtn.disabled = true;
    setStatus("Analyzing…");

    abortCtrl = new AbortController();
    const start = performance.now();

    try{
      const fd = new FormData();
      fd.append("image", blob, "frame.jpg");
      const res = await fetch("/api/detect", { method:"POST", body:fd, signal:abortCtrl.signal });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      resultImg.src = data.output_url + "?t=" + Date.now();
      downloadBtn.disabled = false;

      // Metrics
      const end = performance.now();
      latencyEl.textContent = `${Math.round(end - start)} ms`;
      const now = end;
      fpsEl.textContent = String(Math.max(1, Math.round(1000/Math.max(1, now - lastTick))));
      lastTick = now;

      setStatus("Done!");
      toast("Detection complete!");
    }catch(err){
      if (err.name !== "AbortError") {
        setStatus("Error: " + err.message);
        toast("Detection failed", "error");
      }
    }finally{
      loader.classList.add("hidden");
      detectBtn.disabled = false;
      inFlight = false;
      abortCtrl = null;
    }
  }

  // --- Webcam
  startWebcamBtn.addEventListener("click", startWebcam);
  stopWebcamBtn.addEventListener("click", stopWebcam);

  async function startWebcam(){
    try{
      webcamStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user" }, audio:false });
      webcam.srcObject = webcamStream;
      webcam.classList.remove("hidden");
      previewImg.classList.add("hidden");
      startWebcamBtn.classList.add("hidden");
      stopWebcamBtn.classList.remove("hidden");
      setStatus("Webcam started. Running detections…");
      webcamInterval = setInterval(captureAndDetect, 1200); // ~1 fps (adjust as needed)
    }catch{
      toast("Webcam access denied or unavailable.", "error");
    }
  }

  function stopWebcam(){
    if (webcamStream){ webcamStream.getTracks().forEach(t=>t.stop()); webcamStream = null; }
    if (webcamInterval){ clearInterval(webcamInterval); webcamInterval = null; }
    if (abortCtrl){ abortCtrl.abort(); abortCtrl = null; }
    webcam.classList.add("hidden");
    previewImg.classList.remove("hidden");
    startWebcamBtn.classList.remove("hidden");
    stopWebcamBtn.classList.add("hidden");
    setStatus("Webcam stopped.");
  }

  async function captureAndDetect(){
    if (!webcamStream || inFlight) return;
    const v = webcam;
    if (!v.videoWidth || !v.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
    if (blob) await detectWithBlob(blob);
  }

  // --- Download
  downloadBtn.addEventListener("click", () => {
    if (!resultImg.src) return;
    const a = document.createElement("a");
    a.href = resultImg.src; a.download = "result.png"; a.click();
  });

  // --- Theme
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    themeToggle.textContent = document.body.classList.contains("light-mode") ? "☀️" : "🌙";
  });
});
