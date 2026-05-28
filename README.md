# 📅 Schedule Bot

> Discord 스터디/모임 일정 조율 봇 + REST API

참여자들의 **가능 시간을 투표로 수집**하고, **최적 시간을 자동 추천**해주는 Discord 봇입니다.
PostgreSQL 기반 데이터 저장 및 Express REST API를 통해 일정 데이터를 외부에서도 조회할 수 있습니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📊 **가능 시간 투표** | 최대 10개 후보 시간 복수 선택 투표 |
| 🏆 **최적 시간 추천** | 참가자 수 기준 상위 3개 자동 추천 |
| ⏰ **리마인더 알림** | 마감 1시간 전 독촉, 마감 후 자동 결과 공지 |
| 👥 **참가자 관리** | 투표 현황 실시간 업데이트 |
| ✅ **일정 확정** | 확정 시 참가자 전체 멘션 알림 |
| 🌐 **REST API** | 일정 조회 / 통계 엔드포인트 제공 |

---

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here       # 개발 중에만 사용

DATABASE_URL=postgresql://user:password@localhost:5432/schedulebot
API_KEY=your_random_secret_key
PORT=3000
```

### 3. DB 마이그레이션

```bash
npm run migrate
```

### 4. 슬래시 커맨드 등록

```bash
npm run deploy
```

### 5. 봇 실행

```bash
npm start
```

---

## 🌐 REST API

모든 요청에 헤더 `x-api-key: {API_KEY}` 필요 (`/api/health` 제외)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 헬스체크 (DB 연결 확인) |
| GET | `/api/schedules/:guildId` | 서버 일정 목록 (`?status=active\|confirmed\|all`) |
| GET | `/api/schedule/:id` | 일정 상세 + 투표 현황 + 추천 시간 |
| GET | `/api/stats/:guildId` | 서버 통계 (총 일정 수, 투표 수, 활발한 유저) |

### 응답 예시

```json
// GET /api/schedule/:id
{
  "id": "a1b2c3d4",
  "title": "알고리즘 스터디 5주차",
  "deadline": "2025-01-10T15:00:00.000Z",
  "confirmed": false,
  "slots": [
    { "index": 0, "label": "월요일 저녁 8시", "voterCount": 3, "voters": ["111", "222", "333"] },
    { "index": 1, "label": "수요일 저녁 9시", "voterCount": 2, "voters": ["111", "222"] }
  ],
  "recommended": [
    { "label": "월요일 저녁 8시", "voterCount": 3, "voters": ["111", "222", "333"] }
  ]
}
```

---

## 🗂️ 프로젝트 구조

```
schedule-bot/
├── src/
│   ├── api/
│   │   ├── routes.js          # REST API 라우터
│   │   └── server.js          # Express 앱
│   ├── commands/
│   │   └── schedule.js        # 슬래시 커맨드 정의
│   ├── db/
│   │   ├── pool.js            # PostgreSQL 연결 풀
│   │   └── migrate.js         # 테이블 생성 마이그레이션
│   ├── events/
│   │   ├── interactionCreate.js  # 모달/버튼/셀렉트 핸들러
│   │   └── reminder.js           # 크론 기반 리마인더
│   ├── utils/
│   │   ├── store.js           # DB 기반 데이터 접근 레이어
│   │   └── scheduler.js       # 일정 추천 알고리즘
│   ├── deploy-commands.js
│   └── index.js
├── Dockerfile
├── fly.toml
└── package.json
```

---

## 🛠️ 기술 스택

- **Runtime**: Node.js 20
- **Discord API**: discord.js v14
- **Web Framework**: Express v4
- **Database**: PostgreSQL (pg 드라이버)
- **스케줄러**: node-cron
- **배포**: Fly.io + Docker

---

## ☁️ Fly.io 배포

```bash
# 1. flyctl 설치
# https://fly.io/docs/hands-on/install-flyctl/

# 2. 로그인
fly auth login

# 3. 앱 초기화 (fly.toml 자동 생성)
fly launch

# 4. PostgreSQL 연결 (Fly Postgres)
fly postgres create --name schedule-bot-db
fly postgres attach schedule-bot-db

# DATABASE_URL은 attach 시 자동으로 환경변수에 추가됨

# 5. 나머지 환경변수 설정
fly secrets set DISCORD_TOKEN=xxx CLIENT_ID=xxx API_KEY=xxx

# 6. 배포 (migrate → start 자동 실행)
fly deploy
```

이후 `git push` 후 `fly deploy` 만으로 재배포됩니다.

