import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiaryEntry, Weather, Mood } from '../types';

const STORAGE_KEY = 'GRIM_entries';
// 편집 중 임시저장 (commit 안 된 변경). entry id 별로 분리 저장 → 다중 entry 동시 편집 안전.
const DRAFT_KEY_PREFIX = 'GRIM_draft:';

export async function loadEntries(): Promise<DiaryEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveEntries(entries: DiaryEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function getEntry(id: string): Promise<DiaryEntry | undefined> {
  const entries = await loadEntries();
  return entries.find((e) => e.id === id);
}

export async function getEntryByDate(date: string): Promise<DiaryEntry | undefined> {
  const entries = await loadEntries();
  return entries.find((e) => e.date === date);
}

export async function upsertEntry(entry: DiaryEntry): Promise<void> {
  const entries = await loadEntries();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = { ...entry, updatedAt: new Date().toISOString() };
  } else {
    entries.push({
      ...entry,
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  await saveEntries(entries);
}

export async function deleteEntry(id: string): Promise<void> {
  const entries = (await loadEntries()).filter((e) => e.id !== id);
  await saveEntries(entries);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getTodayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────
// Draft (임시저장) — 수정 모드 중 자동저장 대상.
// upsertEntry 와 별개. 완료 버튼 누르기 전엔 entry 본체에 반영되지 않음.
// ─────────────────────────────────────────────────────────
export type EntryDraft = {
  content?: string;
  weather?: Weather | null;
  mood?: Mood | null;
  savedAt: string;
};

export async function loadDraft(entryId: string): Promise<EntryDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY_PREFIX + entryId);
    return raw ? (JSON.parse(raw) as EntryDraft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(
  entryId: string,
  partial: Omit<EntryDraft, 'savedAt'>
): Promise<void> {
  const payload: EntryDraft = { ...partial, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(DRAFT_KEY_PREFIX + entryId, JSON.stringify(payload));
}

export async function clearDraft(entryId: string): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY_PREFIX + entryId);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${days[d.getDay()]})`;
}
