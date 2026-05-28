import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../../data/schedules.json');

function load() {
  if (!existsSync(DATA_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function getSchedule(scheduleId) {
  const db = load();
  return db[scheduleId] ?? null;
}

export function getAllSchedules() {
  return load();
}

export function saveSchedule(schedule) {
  const db = load();
  db[schedule.id] = schedule;
  save(db);
}

export function deleteSchedule(scheduleId) {
  const db = load();
  delete db[scheduleId];
  save(db);
}

export function getGuildSchedules(guildId) {
  const db = load();
  return Object.values(db).filter(s => s.guildId === guildId);
}
