
import pool from '../db/pool.js';

// ─── 내부 헬퍼: DB row → 앱에서 쓰는 schedule 객체 ───────────────────────────

async function rowToSchedule(row) {
  if (!row) return null;

  // 투표 데이터 JOIN
  const { rows: voteRows } = await pool.query(
    'SELECT user_id, slot_indices FROM votes WHERE schedule_id = $1',
    [row.id]
  );

  const availability = {};
  for (const v of voteRows) {
    availability[v.user_id] = v.slot_indices;
  }

  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    creatorId: row.creator_id,
    title: row.title,
    slots: row.slots,
    minParticipants: row.min_participants,
    deadline: row.deadline.toISOString(),
    confirmed: row.confirmed,
    confirmedSlot: row.confirmed_slot,
    warnedDeadline: row.warned_deadline,
    closedAnnounced: row.closed_announced,
    createdAt: row.created_at.toISOString(),
    availability,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSchedule(scheduleId) {
  const { rows } = await pool.query('SELECT * FROM schedules WHERE id = $1', [scheduleId]);
  return rowToSchedule(rows[0]);
}

export async function getAllSchedules() {
  const { rows } = await pool.query('SELECT * FROM schedules');
  const result = {};
  for (const row of rows) {
    const s = await rowToSchedule(row);
    result[s.id] = s;
  }
  return result;
}

export async function getGuildSchedules(guildId) {
  const { rows } = await pool.query(
    'SELECT * FROM schedules WHERE guild_id = $1 ORDER BY created_at DESC',
    [guildId]
  );
  return Promise.all(rows.map(rowToSchedule));
}

export async function saveSchedule(schedule) {
  const {
    id, guildId, channelId, creatorId, title, slots,
    minParticipants, deadline, confirmed, confirmedSlot,
    warnedDeadline, closedAnnounced, availability,
  } = schedule;

  // UPSERT schedules
  await pool.query(
    `INSERT INTO schedules
       (id, guild_id, channel_id, creator_id, title, slots, min_participants,
        deadline, confirmed, confirmed_slot, warned_deadline, closed_announced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       title            = EXCLUDED.title,
       slots            = EXCLUDED.slots,
       min_participants = EXCLUDED.min_participants,
       deadline         = EXCLUDED.deadline,
       confirmed        = EXCLUDED.confirmed,
       confirmed_slot   = EXCLUDED.confirmed_slot,
       warned_deadline  = EXCLUDED.warned_deadline,
       closed_announced = EXCLUDED.closed_announced`,
    [id, guildId, channelId, creatorId, title, JSON.stringify(slots),
     minParticipants, deadline, confirmed, confirmedSlot ?? null,
     warnedDeadline ?? false, closedAnnounced ?? false]
  );

  // 투표 UPSERT (availability)
  if (availability) {
    for (const [userId, slotIndices] of Object.entries(availability)) {
      await pool.query(
        `INSERT INTO votes (schedule_id, user_id, slot_indices)
         VALUES ($1, $2, $3)
         ON CONFLICT (schedule_id, user_id) DO UPDATE SET
           slot_indices = EXCLUDED.slot_indices,
           voted_at     = NOW()`,
        [id, userId, slotIndices]
      );
    }
  }
}

export async function deleteSchedule(scheduleId) {
  // votes는 ON DELETE CASCADE로 자동 삭제
  await pool.query('DELETE FROM schedules WHERE id = $1', [scheduleId]);

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
}
