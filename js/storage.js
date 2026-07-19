const KEY = "partyOfTwo.sessions.v1";
function read() { try { return JSON.parse(globalThis.localStorage?.getItem(KEY) || "{}"); } catch { return {}; } }
function write(v) { try { globalThis.localStorage?.setItem(KEY, JSON.stringify(v)); } catch {} }
export function loadPlayerSession(code) { const v = read()[String(code || "").toUpperCase()]; return v?.resumeToken ? { ...v } : null; }
export function savePlayerSession(code, value) { if (!value?.resumeToken) return; const all = read(); all[String(code).toUpperCase()] = { resumeToken: String(value.resumeToken), name: String(value.name || "").slice(0,24) }; write(all); }
export function clearPlayerSession(code) { const all = read(); delete all[String(code || "").toUpperCase()]; write(all); }
export function createResumeToken() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
