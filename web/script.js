import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getDatabase, onValue, ref } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxHshF7Z36b0LC4-xQJEu_tq-GFJVyoqw",
  authDomain: "heartshare-a100d.firebaseapp.com",
  databaseURL: "https://heartshare-a100d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "heartshare-a100d",
  storageBucket: "heartshare-a100d.firebasestorage.app",
  messagingSenderId: "751019427212",
  appId: "1:751019427212:web:e93cc306b3352efd3742a9",
  measurementId: "G-NRFKZ5DYFC"
};

const bpmValue = document.getElementById("bpmValue");
const statusPill = document.getElementById("statusPill");
const statusText = document.getElementById("statusText");
const updatedAt = document.getElementById("updatedAt");
const sampleAt = document.getElementById("sampleAt");

let currentBpm = 0;
let targetBpm = 0;
let latestTimestamp = 0;
let latestSampleTimestamp = 0;
let online = false;
let hasReceivedValue = false;
let animationFrameId = 0;

function setBeatDuration(bpm) {
  if (!Number.isFinite(bpm) || bpm <= 0) return;
  const duration = Math.max(0.38, Math.min(1.5, 60 / bpm));
  document.documentElement.style.setProperty("--beat-duration", `${duration}s`);
}

function setStatus(nextStatus) {
  statusPill.classList.remove("live", "waiting", "offline");
  statusPill.classList.add(nextStatus);

  if (nextStatus === "live") {
    statusText.textContent = "LIVE";
  } else if (nextStatus === "offline") {
    statusText.textContent = "Offline";
  } else {
    statusText.textContent = "Waiting...";
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "未受信";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 5) return "たった今";
  if (diffSeconds < 60) return `${diffSeconds}秒前`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}分前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}日前`;
}

function updateStatusFromData() {
  updatedAt.textContent = formatRelativeTime(latestTimestamp);
  sampleAt.textContent = formatRelativeTime(latestSampleTimestamp);

  if (!hasReceivedValue) {
    setStatus("waiting");
    return;
  }

  const stale = latestTimestamp > 0 && Date.now() - latestTimestamp > 20_000;
  setStatus(online && !stale ? "live" : "offline");
}

function renderBpm() {
  const distance = targetBpm - currentBpm;

  if (Math.abs(distance) < 0.15) {
    currentBpm = targetBpm;
  } else {
    currentBpm += distance * 0.11;
  }

  if (hasReceivedValue) {
    bpmValue.textContent = Math.round(currentBpm).toString();
  }

  animationFrameId = requestAnimationFrame(renderBpm);
}

function applySnapshot(value) {
  if (!value || typeof value !== "object") {
    hasReceivedValue = false;
    bpmValue.textContent = "Waiting...";
    latestTimestamp = 0;
    latestSampleTimestamp = 0;
    online = false;
    updateStatusFromData();
    return;
  }

  const nextBpm = Number(value.heartRate);
  const nextTimestamp = Number(value.timestamp);
  const nextSampleTimestamp = Number(value.sampleTimestamp);

  online = Boolean(value.online);
  latestTimestamp = Number.isFinite(nextTimestamp) ? nextTimestamp : Date.now();
  latestSampleTimestamp = Number.isFinite(nextSampleTimestamp) ? nextSampleTimestamp : latestTimestamp;

  if (Number.isFinite(nextBpm) && nextBpm > 0) {
    targetBpm = nextBpm;
    if (!hasReceivedValue) currentBpm = nextBpm;
    hasReceivedValue = true;
    setBeatDuration(nextBpm);
  }

  updateStatusFromData();
}

function boot() {
  try {
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    const liveRef = ref(database, "/");

    onValue(
      liveRef,
      snapshot => applySnapshot(snapshot.val()),
      error => {
        console.error("Firebase connection failed", error);
        hasReceivedValue = false;
        online = false;
        setStatus("offline");
        updatedAt.textContent = "接続エラー";
      }
    );
  } catch (error) {
    console.error("Firebase initialization failed", error);
    setStatus("offline");
    updatedAt.textContent = "設定エラー";
  }

  renderBpm();
  setInterval(updateStatusFromData, 1_000);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("Service worker registration failed", error);
    });
  });
}

window.addEventListener("beforeunload", () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

boot();
