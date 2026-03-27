// ============================================================
//  functions.js — Anthropic Streaming API
//  Replace API_BASE_URL with your backend proxy endpoint.
// ============================================================
 
const API_BASE_URL = "YOUR_URL_HERE"; // <-- paste your URL here
 
// ── DOM refs ─────────────────────────────────────────────────
const promptEl        = document.getElementById("prompt");
const sendBtn         = document.getElementById("sendBtn");
const stopBtn         = document.getElementById("stopBtn");
const statusPill      = document.getElementById("statusPill");
const responseBlock   = document.getElementById("responseBlock");
const responseText    = document.getElementById("responseText");
const responseBody    = document.getElementById("responseBody");
const cursor          = document.getElementById("cursor");
const emptyState      = document.getElementById("emptyState");
const errorMsg        = document.getElementById("errorMsg");
const promptEcho      = document.getElementById("promptEcho");
const copyResponseBtn = document.getElementById("copyResponseBtn");
 
// ── State ─────────────────────────────────────────────────────
let abortController = null;
let fullText = "";
 
// ── Keyboard shortcut: Enter to send ─────────────────────────
promptEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
 
// ── Status pill ───────────────────────────────────────────────
function setStatus(state) {
  statusPill.className = "status-pill" + (state === "streaming" ? " streaming" : "");
  const labels = { ready: "ready", streaming: "streaming", done: "done", error: "error" };
  statusPill.textContent = labels[state] || state;
}
 
// ── Error display ─────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = "block";
}
 
function hideError() {
  errorMsg.style.display = "none";
}
 
// ── Clear all output ──────────────────────────────────────────
function clearAll() {
  fullText = "";
  responseText.textContent = "";
  promptEcho.textContent = "";
  emptyState.style.display = "block";
  responseBlock.classList.remove("visible");
  cursor.style.display = "none";
  hideError();
  setStatus("ready");
}
 
// ── Abort active stream ───────────────────────────────────────
function stopStream() {
  if (abortController) {
    abortController.abort();
  }
}
 
// ── Main send + stream function ───────────────────────────────
async function send() {
  const userPrompt = promptEl.value.trim();
  if (!userPrompt) return;
 
  hideError();
  fullText = "";
  responseText.textContent = "";
  emptyState.style.display = "none";
  responseBlock.classList.add("visible");
  cursor.style.display = "inline-block";
  promptEcho.textContent = "\u201C" + userPrompt + "\u201D";
 
  sendBtn.disabled = true;
  stopBtn.style.display = "inline-flex";
  setStatus("streaming");
 
  abortController = new AbortController();
 
  try {
    const res = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        stream: true,
        messages: [{ role: "user", content: userPrompt }]
      }),
      signal: abortController.signal
    });
 
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || "HTTP " + res.status);
    }
 
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
 
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
 
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
 
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") break;
 
        let evt;
        try { evt = JSON.parse(raw); } catch { continue; }
 
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          fullText += evt.delta.text;
          responseText.textContent = fullText;
          responseBody.scrollTop = responseBody.scrollHeight;
        }
 
        if (evt.type === "message_stop") break;
      }
    }
 
    setStatus("done");
 
  } catch (e) {
    if (e.name === "AbortError") {
      setStatus("done");
    } else {
      showError("Error: " + e.message);
      setStatus("error");
    }
  } finally {
    cursor.style.display = "none";
    sendBtn.disabled = false;
    stopBtn.style.display = "none";
    abortController = null;
  }
}
 
// ── Copy response to clipboard ────────────────────────────────
async function copyResponse() {
  if (!fullText) return;
  await navigator.clipboard.writeText(fullText);
  copyResponseBtn.textContent = "copied!";
  copyResponseBtn.classList.add("copied");
  setTimeout(() => {
    copyResponseBtn.textContent = "copy";
    copyResponseBtn.classList.remove("copied");
  }, 1800);
}
