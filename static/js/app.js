document.addEventListener("DOMContentLoaded", () => {
  const dropArea = document.getElementById("dropArea");
  const imageInput = document.getElementById("imageInput");
  const uploaderText = document.getElementById("uploaderText");
  const detectBtn = document.getElementById("detectBtn");
  const previewImg = document.getElementById("preview");
  const resultImg = document.getElementById("result");
  const loader = document.getElementById("loader");
  const statusText = document.getElementById("statusText");
  const downloadBtn = document.getElementById("downloadBtn");
  const themeToggle = document.getElementById("themeToggle");

  let selectedFile = null;

  function showToast(msg, type=""){ 
    const t=document.createElement("div");
    t.className="toast "+type; t.textContent=msg;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),3000);
  }

  function handleFile(file){
    if(!file.type.startsWith("image/")) return showToast("Invalid file","error");
    selectedFile=file;
    const reader=new FileReader();
    reader.onload=e=>previewImg.src=e.target.result;
    reader.readAsDataURL(file);
    uploaderText.textContent=`Selected: ${file.name}`;
    detectBtn.disabled=false;
    downloadBtn.disabled=true;
    resultImg.src="";
    statusText.textContent="Ready to detect.";
  }

  // Drag-drop
  dropArea.addEventListener("click",()=>imageInput.click());
  imageInput.addEventListener("change",e=>handleFile(e.target.files[0]));
  ["dragover","dragleave","drop"].forEach(ev=>{
    dropArea.addEventListener(ev,e=>{
      e.preventDefault();
      if(ev==="dragover") dropArea.classList.add("drag-over");
      else dropArea.classList.remove("drag-over");
      if(ev==="drop") handleFile(e.dataTransfer.files[0]);
    });
  });

  // Detect
  detectBtn.addEventListener("click",async e=>{
    e.preventDefault();
    if(!selectedFile) return showToast("Choose an image","error");
    detectBtn.disabled=true;
    loader.classList.remove("hidden");
    statusText.textContent="";

    try{
      const fd=new FormData();
      fd.append("image",selectedFile);
      const res=await fetch("/api/detect",{method:"POST",body:fd});
      if(!res.ok) throw new Error("Server error");
      const data=await res.json();
      resultImg.src=data.output_url+"?t="+Date.now();
      loader.classList.add("hidden");
      statusText.textContent="Done!";
      downloadBtn.disabled=false;
      showToast("Detection complete!","success");
    }catch(err){
      loader.classList.add("hidden");
      statusText.textContent="Error: "+err.message;
      showToast("Detection failed","error");
    }finally{
      detectBtn.disabled=false;
    }
  });

  // Download
  downloadBtn.addEventListener("click",()=>{
    const link=document.createElement("a");
    link.href=resultImg.src;
    link.download="result.png";
    link.click();
  });

  // Theme
  themeToggle.addEventListener("click",()=>{
    document.body.classList.toggle("light-mode");
    themeToggle.textContent=document.body.classList.contains("light-mode")?"☀️":"🌙";
  });
});
