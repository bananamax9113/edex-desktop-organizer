const fs = require("fs");
const path = require("path");

function notesPath(userData) {
  return path.join(userData, "calendar-notes.json");
}

function loadNotes(userData) {
  const file = notesPath(userData);
  if (!fs.existsSync(file)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveNotes(userData, notes) {
  fs.writeFileSync(notesPath(userData), JSON.stringify(notes, null, 2), "utf8");
  return notes;
}

function addNote(userData, dateKey, text) {
  const notes = loadNotes(userData);
  const list = Array.isArray(notes[dateKey]) ? notes[dateKey] : [];
  const item = {
    id: `n${Date.now()}`,
    text: String(text || "").trim(),
    at: Date.now()
  };
  if (!item.text) return { notes, item: null };
  list.push(item);
  notes[dateKey] = list;
  saveNotes(userData, notes);
  return { notes, item };
}

function updateNote(userData, dateKey, id, text) {
  const notes = loadNotes(userData);
  const list = Array.isArray(notes[dateKey]) ? notes[dateKey] : [];
  const next = String(text || "").trim();
  if (!next) return { notes, item: null };
  let item = null;
  notes[dateKey] = list.map((n) => {
    if (n.id !== id) return n;
    item = { ...n, text: next, at: Date.now() };
    return item;
  });
  if (!item) return { notes, item: null };
  saveNotes(userData, notes);
  return { notes, item };
}

function removeNote(userData, dateKey, id) {
  const notes = loadNotes(userData);
  notes[dateKey] = (notes[dateKey] || []).filter((n) => n.id !== id);
  if (!notes[dateKey].length) delete notes[dateKey];
  saveNotes(userData, notes);
  return notes;
}

module.exports = { loadNotes, saveNotes, addNote, updateNote, removeNote };
