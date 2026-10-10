/** Minimal stub — full embed docking can be restored later. */

async function resolveShortcut(filePath) {
  return { ok: true, path: String(filePath || ""), target: String(filePath || "") };
}

async function listTopWindows() {
  return [];
}

function hwndFromBuffer() {
  return "0";
}

async function launchAndDock() {
  return { ok: false, message: "視窗嵌入功能尚未還原" };
}

async function dockWindow() {
  return false;
}

async function setDockBounds() {
  return false;
}

async function releaseEmbed() {
  return true;
}

async function focusDock() {
  return false;
}

async function captureWindowPng() {
  return "";
}

async function releaseAllEmbeds() {
  return true;
}

function stopEmbedDaemon() {}

module.exports = {
  resolveShortcut,
  listTopWindows,
  hwndFromBuffer,
  launchAndDock,
  dockWindow,
  setDockBounds,
  releaseEmbed,
  focusDock,
  captureWindowPng,
  releaseAllEmbeds,
  stopEmbedDaemon
};
