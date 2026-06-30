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
const sampleAt = document.getElementById("sampleAt");
const chartRange = document.getElementById("chartRange");
const chartScroller = document.getElementById("chartScroller");
const axisMax = document.getElementById("axisMax");
const axisMid = document.getElementById("axisMid");
const axisMin = document.getElementById("axisMin");
const historyChart = document.getElementById("historyChart");
const chartContext = historyChart.getContext("2d");

const HISTORY_WINDOW_MILLIS = 48 * 60 * 60 * 1000;
const VISIBLE_WINDOW_MILLIS = 6 * 60 * 60 * 1000;
const GRAPH_MIN_BPM = 60;
const GRAPH_MID_BPM = 90;
const GRAPH_MAX_BPM = 120;

let currentBpm = 0;
let targetBpm = 0;
let latestTimestamp = 0;
let latestSampleTimestamp = 0;
let online = false;
let hasReceivedValue = false;
let animationFrameId = 0;
let historyPoints = [];
let shouldStickToLatest = true;

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

  const sorted = Object.values(value)
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
    .sort((a, b) => a.timestamp - b.timestamp);

  return sorted.reduce((points, point) => {
    const previous = points[points.length - 1];
    if (!previous || previous.heartRate !== point.heartRate) {
      points.push(point);
    }
    return points;
  }, []);
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
  const desiredCssWidth = Math.max(visibleWidth, visibleWidth * (HISTORY_WINDOW_MILLIS / VISIBLE_WINDOW_MILLIS));
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
  const padding = { top: 26, right: 24, bottom: 48, left: 10 };
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

  if (historyPoints.length < 1) {
    chartContext.fillStyle = "rgba(255, 255, 255, 0.64)";
    chartContext.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    chartContext.textAlign = "center";
    chartContext.fillText("履歴を収集中", cssWidth / 2, cssHeight / 2);
    chartRange.textContent = "履歴待ち";
    resetYAxisLabels();
    chartContext.restore();
    return;
  }

  const minRate = GRAPH_MIN_BPM;
  const maxRate = GRAPH_MAX_BPM;
  const rateSpan = Math.max(1, maxRate - minRate);

  const windowEnd = Date.now();
  const windowStart = windowEnd - HISTORY_WINDOW_MILLIS;
  const xForTime = timestamp => {
    const ratio = Math.max(0, Math.min(1, (timestamp - windowStart) / HISTORY_WINDOW_MILLIS));
    return padding.left + innerWidth * ratio;
  };
  const yFor = rate => {
    const clampedRate = Math.max(minRate, Math.min(maxRate, rate));
    return padding.top + innerHeight - ((clampedRate - minRate) / rateSpan) * innerHeight;
  };
  const pointFor = point => ({
    x: xForTime(point.timestamp),
    y: yFor(point.heartRate)
  });

  drawYAxisLabels();

  const gradient = chartContext.createLinearGradient(0, padding.top, 0, padding.top + innerHeight);
  gradient.addColorStop(0, "rgba(255, 45, 85, 0.34)");
  gradient.addColorStop(1, "rgba(255, 45, 85, 0)");

  const points = historyPoints.map(pointFor);
  if (points.length >= 2) {
    drawSmoothPath(points);
    chartContext.lineTo(points[points.length - 1].x, padding.top + innerHeight);
    chartContext.lineTo(points[0].x, padding.top + innerHeight);
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
  }

  const latest = historyPoints[historyPoints.length - 1];
  const latestX = points[points.length - 1].x;
  const latestY = yFor(latest.heartRate);
  chartContext.shadowBlur = 18;
  chartContext.fillStyle = "#ffffff";
  chartContext.beginPath();
  chartContext.arc(latestX, latestY, 4, 0, Math.PI * 2);
  chartContext.fill();

  drawPointLabels({
    points,
    historyPoints,
    padding,
    innerHeight,
    chartHeight: cssHeight
  });

  const first = historyPoints[0];
  chartRange.textContent = `${formatClock(first.timestamp)} - ${formatClock(latest.timestamp)}`;
  if (shouldStickToLatest) {
    chartScroller.scrollLeft = chartScroller.scrollWidth;
  }
  chartContext.restore();
}

function resetYAxisLabels() {
  drawYAxisLabels();
}

function drawYAxisLabels() {
  axisMax.textContent = `${GRAPH_MAX_BPM} bpm`;
  axisMid.textContent = `${GRAPH_MID_BPM} bpm`;
  axisMin.textContent = `${GRAPH_MIN_BPM} bpm`;
}

function drawPointLabels({ points, historyPoints, padding, innerHeight, chartHeight }) {
  chartContext.save();
  chartContext.shadowBlur = 0;
  chartContext.textAlign = "center";
  chartContext.textBaseline = "middle";

  const occupied = [];
  const timeLabelEvery = Math.max(1, Math.ceil(historyPoints.length / Math.max(5, Math.floor(historyChart.clientWidth / 120))));

  points.forEach((point, index) => {
    chartContext.fillStyle = "rgba(255, 255, 255, 0.94)";
    chartContext.beginPath();
    chartContext.arc(point.x, point.y, 3.4, 0, Math.PI * 2);
    chartContext.fill();

    const bpmLabel = `${Math.round(historyPoints[index].heartRate)}`;
    const labelWidth = Math.max(22, chartContext.measureText(bpmLabel).width + 12);
    const preferredAbove = index % 2 === 0;
    const labelY = chooseLabelY({
      x: point.x,
      y: point.y,
      width: labelWidth,
      height: 18,
      preferredAbove,
      occupied,
      minY: padding.top + 9,
      maxY: padding.top + innerHeight - 9
    });

    drawRoundedLabel({
      text: bpmLabel,
      x: point.x,
      y: labelY,
      width: labelWidth,
      height: 18
    });
    occupied.push({
      left: point.x - labelWidth / 2,
      right: point.x + labelWidth / 2,
      top: labelY - 9,
      bottom: labelY + 9
    });

    const shouldDrawTime = index === 0 || index === points.length - 1 || index % timeLabelEvery === 0;
    if (!shouldDrawTime) return;

    const timeText = formatClock(historyPoints[index].sampleTimestamp || historyPoints[index].timestamp);
    const timeWidth = chartContext.measureText(timeText).width + 8;
    const timeBox = {
      left: point.x - timeWidth / 2,
      right: point.x + timeWidth / 2,
      top: padding.top + innerHeight + 10,
      bottom: Math.min(chartHeight - 4, padding.top + innerHeight + 28)
    };

    if (occupied.some(box => boxesOverlap(box, timeBox))) return;

    chartContext.fillStyle = "rgba(255, 255, 255, 0.62)";
    chartContext.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    chartContext.fillText(timeText, point.x, padding.top + innerHeight + 20);
    occupied.push(timeBox);
  });

  chartContext.restore();
}

function chooseLabelY({ x, y, width, height, preferredAbove, occupied, minY, maxY }) {
  const offsets = preferredAbove ? [-18, 18, -34, 34, -50, 50] : [18, -18, 34, -34, 50, -50];

  for (const offset of offsets) {
    const candidateY = Math.max(minY, Math.min(maxY, y + offset));
    const candidate = {
      left: x - width / 2,
      right: x + width / 2,
      top: candidateY - height / 2,
      bottom: candidateY + height / 2
    };
    if (!occupied.some(box => boxesOverlap(box, candidate))) return candidateY;
  }

  return Math.max(minY, Math.min(maxY, y + (preferredAbove ? -18 : 18)));
}

function drawRoundedLabel({ text, x, y, width, height }) {
  const left = x - width / 2;
  const top = y - height / 2;
  const radius = 6;

  chartContext.beginPath();
  chartContext.moveTo(left + radius, top);
  chartContext.lineTo(left + width - radius, top);
  chartContext.quadraticCurveTo(left + width, top, left + width, top + radius);
  chartContext.lineTo(left + width, top + height - radius);
  chartContext.quadraticCurveTo(left + width, top + height, left + width - radius, top + height);
  chartContext.lineTo(left + radius, top + height);
  chartContext.quadraticCurveTo(left, top + height, left, top + height - radius);
  chartContext.lineTo(left, top + radius);
  chartContext.quadraticCurveTo(left, top, left + radius, top);
  chartContext.closePath();
  chartContext.fillStyle = "rgba(255, 45, 85, 0.82)";
  chartContext.fill();

  chartContext.fillStyle = "#ffffff";
  chartContext.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  chartContext.fillText(text, x, y + 0.5);
}

function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
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
        sampleAt.textContent = "接続エラー";
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
    sampleAt.textContent = "設定エラー";
  }

  renderBpm();
  setInterval(updateStatusFromData, 1_000);
  window.addEventListener("resize", drawHistoryChart);
  chartScroller.addEventListener("scroll", () => {
    const distanceFromRight = chartScroller.scrollWidth - chartScroller.clientWidth - chartScroller.scrollLeft;
    shouldStickToLatest = distanceFromRight < 24;
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js", { updateViaCache: "none" })
      .then(registration => registration.update())
      .catch(error => {
        console.warn("Service worker registration failed", error);
      });
  });
}

window.addEventListener("beforeunload", () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

boot();
