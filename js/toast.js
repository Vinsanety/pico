let toastIdCounter = 0;
const toastQueue = [];
let activeToasts = 0;
const maxVisible = 3;

export function showToast(message, type = "success") {
  toastQueue.push({ message, type, id: ++toastIdCounter });
  processQueue();
}

function processQueue() {
  if (activeToasts >= maxVisible || toastQueue.length === 0) return;

  const { message, type, id } = toastQueue.shift();
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.dataset.id = id;

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = type === "success" ? "✅ " : "🗑️ ";

  const text = document.createElement("span");
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.insertBefore(toast, container.firstChild);

  requestAnimationFrame(() => toast.classList.add("show"));

  activeToasts++;

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
      activeToasts--;
      processQueue();
    }, 250);
  }, 5000);
}
