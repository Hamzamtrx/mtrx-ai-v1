# Facebook Ad Analysis Framework

## Section 0: Data Requirements (Before Analysis Can Run)

Every ad in the system must have complete data before the analysis framework can produce accurate insights. This section defines what data is required per ad.

### Required Data Per Video Ad

| Field | Source | When Populated | Notes |
|-------|--------|----------------|-------|
| `video_id` | Facebook Graph API | On sync | Required to download video |
| `video_transcript` | OpenAI Whisper | Auto-processed after sync | Full transcript of spoken words |
| `video_description` | Google Gemini | Auto-processed after sync | 19-section visual analysis |
| `spend` | Facebook Marketing API | Every sync (3 days) | Performance metric |
| `purchases` | Facebook Marketing API | Every sync (3 days) | Performance metric |
| `cpa` | Calculated | Every sync (3 days) | spend / purchases |
| `roas` | Facebook Marketing API | Every sync (3 days) | Performance metric |
| `classification` | Auto-calculated | After each sync | winner/potential/new/loser |

### Required Data Per Static Ad

| Field | Source | When Populated | Notes |
|-------|--------|----------------|-------|
| `image_url` | Facebook Graph API | On sync | Creative image |
| `headline` | Facebook Graph API | On sync | Ad headline text |
| `body` | Facebook Graph API | On sync | Ad body copy |
| `spend` / `purchases` / `cpa` / `roas` | Facebook Marketing API | Every sync | Performance metrics |

### Data Completeness Thresholds

The analysis framework requires:
- **Minimum 90% of video ads** have transcripts for accurate angle detection
- **Minimum 90% of video ads** have visual analysis for format classification
- **At least 10 ads** classified as "winner" for pattern recognition
- **At least 30 days** of spend data for meaningful performance trends

---

## Sync Architecture

### 1. Creative Processing (One-Time Per Ad)

When a new ad enters the system, it gets processed ONCE:

```
Ad Imported → Fetch video_id → Whisper Transcript → Gemini Visual Analysis → Auto-Tagged
```

**Cost**: ~$0.88 per batch of new ads (Whisper + Gemini API calls)

This only happens once because the creative doesn't change — the video is the same video forever.

### 2. Performance Sync (Every 3 Days)

The system pulls updated metrics from Facebook:
- Spend
- Purchases
- CPA
- ROAS
- Impressions / Clicks / CTR

**Why 3 days?**
- Daily sync creates noise — a $200 spend ad looks terrible on day 1 but might be fine by day 5
- Facebook's algorithm typically needs 3-5 days to optimize delivery
- 3-day sync gives enough time for spend to accumulate and CPA to stabilize

**Endpoint**: `POST /api/facebook/scheduled/sync-performance/:brandId`

### 3. Full Analysis (Weekly or On-Demand)

The complete 8-section strategic framework runs when planning the next batch:
- Combines performance data with creative tags
- Generates winner patterns, iteration ideas, new angles
- Produces the full insights report

**Endpoint**: `POST /api/facebook/scheduled/full-analysis/:brandId`

---

## Breakout Ad Detection

Runs automatically with each performance sync. Alerts when:

1. **300% Spend Increase**: Ad's spend jumped 3x+ since last sync
2. **$5K Threshold Crossed**: Ad crossed from under $5K to over $5K total spend

**Purpose**: Catch "sleeper ads" that start slow then scale. Don't wait for weekly analysis — start planning iterations immediately.

**Slack Alert**: Configure `SLACK_WEBHOOK_URL` in `.env` to receive breakout notifications.

---

## Trigger Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVERY 3 DAYS (via cron/n8n)                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Pull spend/CPA/ROAS from Facebook Marketing API             │
│  2. Re-classify all ads (winner/potential/loser)                │
│  3. Check for breakout ads → Slack alert if found               │
│  4. Process any new unprocessed video ads                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    WEEKLY (or on-demand)                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Run full 8-section strategic analysis                       │
│  2. Generate test suggestions                                   │
│  3. Output: Complete insights report for next batch planning    │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Scheduled Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/facebook/scheduled/sync-performance/:brandId` | 3-day performance sync |
| POST | `/api/facebook/scheduled/full-analysis/:brandId` | Weekly strategic analysis |
| GET | `/api/facebook/scheduled/status/:brandId` | Check sync/processing status |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/facebook/analysis/strategic-insights/:brandId` | Generate 8-section insights |
| POST | `/api/facebook/analysis/test-suggestions/:brandId` | Generate test ideas |
| GET | `/api/facebook/analysis/strategic-insights/:brandId` | Get cached insights |

---

## Cron/n8n Setup

### Option 1: Cron Job

```bash
# Every 3 days at 6 AM — Performance sync
0 6 */3 * * curl -X POST http://localhost:3000/api/facebook/scheduled/sync-performance/1

# Every Monday at 8 AM — Full analysis
0 8 * * 1 curl -X POST http://localhost:3000/api/facebook/scheduled/full-analysis/1
```

### Option 2: n8n Workflow

1. **Schedule Trigger** → Every 3 days
2. **HTTP Request** → POST to `/api/facebook/scheduled/sync-performance/1`
3. **IF** breakoutAds.length > 0 → **Slack** notification
4. **Every Monday** → POST to `/api/facebook/scheduled/full-analysis/1`

---

## Backfill Existing Ads

For existing ads without transcripts/visuals:

```bash
# Process ALL video ads (will take hours for large accounts)
node backfill-all-videos.js 1

# Process with limit (for testing)
node backfill-all-videos.js 1 --limit=50

# Skip visuals (just transcripts)
node backfill-all-videos.js 1 --skip-visuals
```

**Progress is saved** — you can stop and resume anytime.

---

## Analysis Sections (8 Total)

| # | Key | Title | Focus |
|---|-----|-------|-------|
| 1 | `winningAngles` | What Angles Are Working | Evidence from copy, transcripts, visuals, comments |
| 2 | `commentInsights` | What Comments Tell Us | Audience sentiment, objections, desires |
| 3 | `creatorAnalysis` | What Creators Work | Creator types, energy, delivery style |
| 4 | `visualAndFormat` | Visual & Format Patterns | Production style, format classification |
| 5 | `iterationIdeas` | Iterations on Winners | 2-3 specific tweaks per top winner |
| 6 | `newAngles` | New Angles to Try | Fresh directions from gaps |
| 7 | `audienceSignals` | Audience & Funnel Signals | Who responds, funnel position |
| 8 | `killAndAvoid` | What to Stop & Avoid | Clear losers and anti-patterns |
