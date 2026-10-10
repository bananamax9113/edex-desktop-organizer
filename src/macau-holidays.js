/* Optional Macau holiday labels for the calendar panel */
(function () {
  const map = new Map();
  window.edexMacauHolidays = {
    get: (key) => map.get(String(key || "")) || "",
    set: (key, label) => map.set(String(key || ""), String(label || "")),
    all: () => map
  };
})();
