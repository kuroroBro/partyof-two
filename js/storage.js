const KEY = "partyOfTwo.sessions.v1";
function read() { try { return JSON.parse(globalThis.localStorage?.getItem(KEY) || "{}"); } catch { return {}; } }
function write(v) { try { globalThis.localStorage?.setItem(KEY, JSON.stringify(v)); } catch {} }
export function loadPlayerSession(code) { const v = read()[String(code || "").toUpperCase()]; return v?.resumeToken ? { ...v } : null; }
export function savePlayerSession(code, value) { if (!value?.resumeToken) return; const all = read(); all[String(code).toUpperCase()] = { resumeToken: String(value.resumeToken), name: String(value.name || "").slice(0,24) }; write(all); }
export function clearPlayerSession(code) { const all = read(); delete all[String(code || "").toUpperCase()]; write(all); }
export function createResumeToken() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

// Tracks which question ids this device has already dealt, so a rematch
// (or a fresh show later the same party) draws different questions per
// mode instead of the same ones again -- same convention as this
// portfolio's other question-bank games.
const USED_KEY = "partyOfTwo.usedQuestionIds.v1";
export function loadUsedQuestionIds() { try { const v = JSON.parse(globalThis.localStorage?.getItem(USED_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
export function markQuestionsUsed(ids) { const used = new Set(loadUsedQuestionIds()); (ids || []).forEach((id) => used.add(id)); try { globalThis.localStorage?.setItem(USED_KEY, JSON.stringify([...used])); } catch {} }
export function resetUsedQuestionIds() { try { globalThis.localStorage?.removeItem(USED_KEY); } catch {} }
