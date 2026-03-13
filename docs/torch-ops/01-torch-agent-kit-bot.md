# Torch Agent Kit Bot

## What it does

The bot runs once per day (or on a schedule). For each **eligible target** (next 12:00 UTC with sufficient lead time), it:

1. Builds an OpenAI prompt for that day.
2. Gets one forecast line (Min / Max price range).
3. Parses the line; encodes prices (8 decimals) and stake (HBAR → tinybars).
4. Calls the Torch contract `placeBet(targetTimestamp, priceMin, priceMax)` with payable stake.
5. Persists a **run artifact** per calendar day: `runs/YYYY-MM-DD.json`.

Idempotency: within the same day artifact, each `betKey(symbol, targetTimestamp)` is placed at most once (skipped if already successful).

---

## How it computes targets (12:00 UTC + lead time)

- **Anchor**: `now + MIN_TARGET_LEAD_SECONDS` (default 86 400 = 24h).
- **First target**: next calendar day at **12:00 UTC** ≥ anchor.
- **Count**: `DAYS_AHEAD` targets (default 1).

So with default settings, the bot picks “tomorrow 12:00 UTC” if we’re more than 24h before that.

Code: `src/time/targets.ts` — `getNextEligibleTargets({ minLeadSeconds, daysAhead })`. Each target has `timestamp` (Unix), `monthDay` (e.g. `"March 6"`), `dayLabel`.

---

## OpenAI prompt format (exact string)

From `src/openai/forecast.ts`:

```text
Give me a price range that HBAR token is likely to hit with ${confidencePercent}% probability on ${monthDay}, at 12:00 UTC. Format: 'Min: [0.00000], Max: [0.00000]' - output this quantified forecast only, not need for explanations, or any other text.
```

System message:

```text
Return ONE line only in the exact format requested. No explanations, no extra text. Output only the single line with Min and Max values.
```

`confidencePercent` comes from env `CONFIDENCE_PERCENT` (default 60).

---

## Parse rules (Min/Max)

- **Regex** (from `src/parse/minmax.ts`): `^Min:\s*\[?(\d+(?:\.\d+)?)\]?\s*,\s*Max:\s*\[?(\d+(?:\.\d+)?)\]?\s*\.?\s*$/i`
- Accepts: `Min: [0.09543], Max: [0.10690]` or `Min: 0.09543, Max: 0.10690` with optional trailing period.
- Rules: `min > 0`, `max > min`; otherwise parse fails and the target is recorded with an error in the artifact.

---

## Bet encoding (8dp price, tinybar stake)

- **Prices**: USD per HBAR, 8 decimal places. `parseUnits(priceStr, 8)` → bigint (contract format).
- **Stake**: HBAR string → tinybars (1 HBAR = 1e8 tinybars). Minimum non-zero stake = 1 tinybar.

Code: `src/policy/betPolicy.ts` — `buildBetParams(targetTimestamp, minStr, maxStr, stakeHbar)` → `TorchBetParams` (targetTimestamp, priceMinInt, priceMaxInt, stakeTinybar, stakeHbar).

---

## Hedera tx call path

1. `createHederaClient()` from env (`ACCOUNT_ID`, `PRIVATE_KEY`, `NETWORK`).
2. `placeBet(client, params)` in `src/hedera/torch.ts`:
   - `ContractExecuteTransaction` on `TORCH_CONTRACT_ID`
   - `setPayableAmount(Hbar.fromString(params.stakeHbar))`
   - `setFunction("placeBet", new ContractFunctionParameters().addUint256(targetTimestamp).addUint256(priceMinInt).addUint256(priceMaxInt))`
3. Receipt status `22` = Hedera SUCCESS; only then is `betKey` considered successful for idempotency.

---

## Idempotency (betKey)

- **Key**: `betKey(symbol, targetTimestamp)` = `${SYMBOL}:${targetTimestamp}` (e.g. `HBAR:1741234567`).
- At start of run, load existing artifact for **today** (`runs/YYYY-MM-DD.json`) and build `successfulKeys` from results where `txId` present and `status === 22`.
- For each target, if `successfulKeys.has(betKey)` → skip placement and append result with `skippedDuplicate: true`.
- After a successful `placeBet`, add that `betKey` to `successfulKeys` so the same key is not sent again in the same run.

---

## Artifacts schema (runs/*.json)

**Path**: `torch-agent-kit-bot/runs/YYYY-MM-DD.json` (one file per calendar day; overwritten/updated each run that day).

**Shape** (see `src/storage/runStore.ts`):

```json
{
  "runId": "uuid",
  "timestampUtc": "2025-03-10T14:00:00.000Z",
  "provider": {
    "model": "gpt-5.2-chat-latest",
    "reasoning_effort": "medium",
    "max_completion_tokens": 2048
  },
  "forecasts": [
    {
      "betKey": "HBAR:1741234567",
      "targetTimestamp": 1741234567,
      "monthDay": "March 11",
      "prompt": "Give me a price range...",
      "raw": "Min: [0.09543], Max: [0.10690]",
      "minStr": "0.09543",
      "maxStr": "0.10690"
    }
  ],
  "betParams": [
    {
      "betKey": "HBAR:1741234567",
      "priceMinStr": "0.09543",
      "priceMaxStr": "0.10690",
      "priceMinInt": "9543000",
      "priceMaxInt": "10690000",
      "stakeHbar": "0.1"
    }
  ],
  "results": [
    {
      "betKey": "HBAR:1741234567",
      "targetTimestamp": 1741234567,
      "txId": "0.0.12345@...",
      "status": 22,
      "prompt": "...",
      "raw": "Min: [0.09543], Max: [0.10690]",
      "minStr": "0.09543",
      "maxStr": "0.10690"
    }
  ]
}
```

Optional result fields: `dryRun: true`, `skippedDuplicate: true`, `error: "..."`.

---

## Scheduling

- **Entry**: `npm run daily` (runs `tsx src/runner/run-daily-bet.ts`).
- No built-in cron; use systemd timer, cron, or external scheduler to invoke `npm run daily` once per day (e.g. once in the morning UTC so the next 12:00 UTC target is within lead time).
