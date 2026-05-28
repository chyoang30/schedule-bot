import express from 'express';
import pool from '../db/pool.js';
import { getSchedule, getGuildSchedules } from '../utils/store.js';
import { recommendSlots } from '../utils/scheduler.js';

const router = express.Router();

// ─── GET /api/schedules/:guildId ─────────────────────────────────────────────
// 서버의 전체 일정 목록 (쿼리: ?status=active|confirmed|all)
router.get('/schedules/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { status = 'all' } = req.query;

    let schedules = await getGuildSchedules(guildId);

    if (status === 'active')    schedules = schedules.filter(s => !s.confirmed);
    if (status === 'confirmed') schedules = schedules.filter(s => s.confirmed);

    const result = schedules.map(s => ({
      id: s.id,
      title: s.title,
      slots: s.slots,
      deadline: s.deadline,
      confirmed: s.confirmed,
      confirmedSlot: s.confirmedSlot !== null ? s.slots[s.confirmedSlot] : null,
      voterCount: Object.keys(s.availability).length,
      createdAt: s.createdAt,
    }));

    res.json({ guildId, count: result.length, schedules: result });
  } catch (err) {
    console.error('[API] GET /schedules/:guildId', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/schedule/:id ────────────────────────────────────────────────────
// 특정 일정 상세 + 투표 현황 + 추천 시간
router.get('/schedule/:id', async (req, res) => {
  try {
    const schedule = await getSchedule(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const recommended = recommendSlots(
      schedule.availability,
      schedule.slots,
      schedule.minParticipants
    );

    // 슬롯별 투표 현황 가공
    const slotsWithVotes = schedule.slots.map((slot, i) => {
      const voters = Object.entries(schedule.availability)
        .filter(([, indices]) => indices.includes(i))
        .map(([userId]) => userId);
      return { index: i, label: slot, voterCount: voters.length, voters };
    });

    res.json({
      id: schedule.id,
      title: schedule.title,
      deadline: schedule.deadline,
      confirmed: schedule.confirmed,
      confirmedSlot: schedule.confirmedSlot !== null ? schedule.slots[schedule.confirmedSlot] : null,
      minParticipants: schedule.minParticipants,
      createdAt: schedule.createdAt,
      slots: slotsWithVotes,
      recommended: recommended.map(r => ({
        label: r.label,
        voterCount: r.count,
        voters: r.users,
      })),
    });
  } catch (err) {
    console.error('[API] GET /schedule/:id', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/stats/:guildId ──────────────────────────────────────────────────
// 서버 통계 (총 일정 수, 총 투표 수, 가장 활발한 유저 등)
router.get('/stats/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;

    const [scheduleStats, voteStats, topVoters] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)                             AS total,
           COUNT(*) FILTER (WHERE confirmed)    AS confirmed,
           COUNT(*) FILTER (WHERE NOT confirmed
             AND deadline > NOW())              AS active
         FROM schedules WHERE guild_id = $1`,
        [guildId]
      ),
      pool.query(
        `SELECT COUNT(*) AS total_votes
         FROM votes v
         JOIN schedules s ON s.id = v.schedule_id
         WHERE s.guild_id = $1`,
        [guildId]
      ),
      pool.query(
        `SELECT v.user_id, COUNT(*) AS vote_count
         FROM votes v
         JOIN schedules s ON s.id = v.schedule_id
         WHERE s.guild_id = $1
         GROUP BY v.user_id
         ORDER BY vote_count DESC
         LIMIT 5`,
        [guildId]
      ),
    ]);

    const s = scheduleStats.rows[0];
    res.json({
      guildId,
      schedules: {
        total:     parseInt(s.total),
        confirmed: parseInt(s.confirmed),
        active:    parseInt(s.active),
      },
      totalVotes: parseInt(voteStats.rows[0].total_votes),
      topVoters: topVoters.rows.map(r => ({
        userId: r.user_id,
        voteCount: parseInt(r.vote_count),
      })),
    });
  } catch (err) {
    console.error('[API] GET /stats/:guildId', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
// Fly.io 헬스체크용
router.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

export default router;
