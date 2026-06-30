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
const chartRange = document.getElementById("chartRange");
const chartScroller = document.getElementById("chartScroller");
const historyChart = document.getElementById("historyChart");
const chartContext = historyChart.getContext("2d");

const HISTORY_WINDOW_MILLIS = 48 * 60 * 60 * 1000;

let currentBpm = 0;
let targetBpm = 0;
let latestTimestamp = 0;
let latestSampleTimestamp = 0;
let online = false;
let hasReceivedValue = false;
let animationFrameId = 0;
let historyPoints = [];

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

function normalizeHistory(value) {
  if (!value || typeof value !== "object") return [];
  const cutoff = Date.now() - HISTORY_WINDOW_MILLIS;

  return Object.values(value)
    .map(item => ({
      heartRate: Number(item.heartRate),
      timestamp: Number(item.timestamp),
      sampleTimestamp: Number(item.sampleTimestamp)
    }))
    .filter(item =>
      Number.isFinite(item.heartRate) &&
      Number.isFinite(item.timestamp) &&
      item.timestamp >= cutoff &&
      item.heartRate >= 20 &&
      item.heartRate <= 240
    )
    .sort((a, b) => a.timestamp - b.timestamp)
}

function formatClock(timestamp) {
  if (!timestamp) return "--:--";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}

function drawHistoryChart() {
  const visibleWidth = chartScroller.clientWidth || 320;
  const desiredCssWidth = Math.max(visibleWidth, Math.min(7200, historyPoints.length * 22));
  historyChart.style.width = `${desiredCssWidth}px`;

  const rect = historyChart.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * pixelRatio));
  const height = Math.max(1, Math.floor(rect.height * pixelRatio));

  if (historyChart.width !== width || historyChart.height !== height) {
    historyChart.width = width;
    historyChart.height = height;
  }

  chartContext.clearRect(0, 0, width, height);
  chartContext.save();
  chartContext.scale(pixelRatio, pixelRatio);

  const cssWidth = width / pixelRatio;
  const cssHeight = height / pixelRatio;
  const padding = { top: 18, right: 20, bottom: 46, left: 36 };
  const innerWidth = cssWidth - padding.left - padding.right;
  const innerHeight = cssHeight - padding.top - padding.bottom;

  chartContext.strokeStyle = "rgba(255, 255, 255, 0.14)";
  chartContext.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) {
    const y = padding.top + (innerHeight / 3) * i;
    chartContext.beginPath();
    chartContext.moveTo(padding.left, y);
    chartContext.lineTo(padding.left + innerWidth, y);
    chartContext.stroke();
  }

  if (historyPoints.length < 2) {
    chartContext.fillStyle = "rgba(255, 255, 255, 0.64)";
    chartContext.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    chartContext.textAlign = "center";
    chartContext.fillText("履歴を収集中", cssWidth / 2, cssHeight / 2);
    chartRange.textContent = "履歴待ち";
    chartContext.restore();
    return;
  }

  const rates = historyPoints.map(point => point.heartRate);
  const minRate = Math.max(20, Math.floor(Math.min(...rates) / 5) * 5 - 5);
  const maxRate = Math.min(240, Math.ceil(Math.max(...rates) / 5) * 5 + 5);
  const rateSpan = Math.max(1, maxRate - minRate);

  const xFor = index => padding.left + (innerWidth * index) / (historyPoints.length - 1);
  const yFor = rate => padding.top + innerHeight - ((rate - minRate) / rateSpan) * innerHeight;
  const pointFor = (point, index) => ({
    x: xFor(index),
    y: yFor(point.heartRate)
  });

  chartContext.fillStyle = "rgba(255, 255, 255, 0.52)";
  chartContext.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  chartContext.textAlign = "right";
  chartContext.fillText(String(maxRate), padding.left - 8, padding.top + 4);
  chartContext.fillText(String(minRate), padding.left - 8, padding.top + innerHeight);

  const gradient = chartContext.createLinearGradient(0, padding.top, 0, padding.top + innerHeight);
  gradient.addColorStop(0, "rgba(255, 45, 85, 0.34)");
  gradient.addColorStop(1, "rgba(255, 45, 85, 0)");

  const points = historyPoints.map(pointFor);
  drawSmoothPath(points);
  chartContext.lineTo(xFor(historyPoints.length - 1), padding.top + innerHeight);
  chartContext.lineTo(xFor(0), padding.top + innerHeight);
  chartContext.closePath();
  chartContext.fillStyle = gradient;
  chartContext.fill();

  drawSmoothPath(points);
  chartContext.strokeStyle = "#ff2d55";
  chartContext.lineWidth = 2.4;
  chartContext.lineJoin = "round";
  chartContext.lineCap = "round";
  chartContext.shadowColor = "rgba(255, 45, 85, 0.8)";
  chartContext.shadowBlur = 14;
  chartContext.stroke();

  const latest = historyPoints[historyPoints.length - 1];
  const latestX = xFor(historyPoints.length - 1);
  const latestY = yFor(latest.heartRate);
  chartContext.shadowBlur = 18;
  chartContext.fillStyle = "#ffffff";
  chartContext.beginPath();
  chartContext.arc(latestX, latestY, 4, 0, Math.PI * 2);
  chartContext.fill();

  chartContext.shadowBlur = 0;
  chartContext.fillStyle = "rgba(255, 255, 255, 0.64)";
  chartContext.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  chartContext.textAlign = "center";
  const labelEvery = Math.max(1, Math.ceil(historyPoints.length / Math.max(4, Math.floor(cssWidth / 88))));
  historyPoints.forEach((point, index) => {
    if (index !== 0 && index !== historyPoints.length - 1 && index % labelEvery !== 0) return;
    const x = xFor(index);
    const y = yFor(point.heartRate);
    chartContext.fillStyle = "rgba(255, 255, 255, 0.9)";
    chartContext.beginPath();
    chartContext.arc(x, y, 2.6, 0, Math.PI * 2);
    chartContext.fill();
    chartContext.fillStyle = "rgba(255, 255, 255, 0.62)";
    chartContext.fillText(formatClock(point.sampleTimestamp || point.timestamp), x, padding.top + innerHeight + 20);
  });

  const first = historyPoints[0];
  chartRange.textContent = `${formatClock(first.timestamp)} - ${formatClock(latest.timestamp)}`;
  chartScroller.scrollLeft = chartScroller.scrollWidth;
  chartContext.restore();
}

function drawSmoothPath(points) {
  chartContext.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      chartContext.moveTo(point.x, point.y);
      return;
    }

    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) / 2;
    chartContext.bezierCurveTo(controlX, previous.y, controlX, point.y, point.x, point.y);
  });
}

function applyHistorySnapshot(value) {
  historyPoints = normalizeHistory(value);
  drawHistoryChart();
}

function boot() {
  try {
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    const liveRef = ref(database, "/");
    const historyRef = ref(database, "/history");

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

    onValue(
      historyRef,
      snapshot => applyHistorySnapshot(snapshot.val()),
      error => {
        console.error("Firebase history connection failed", error);
        chartRange.textContent = "履歴エラー";
      }
    );
  } catch (error) {
    console.error("Firebase initialization failed", error);
    setStatus("offline");
    updatedAt.textContent = "設定エラー";
  }

  renderBpm();
  setInterval(updateStatusFromData, 1_000);
  window.addEventListener("resize", drawHistoryChart);
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
