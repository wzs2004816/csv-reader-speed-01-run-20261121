# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/wzs2004816/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/wzs2004816/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0: solve.js reads broken CSV exactly as csv-reader does — same columns, rows and errors on every case — but in a single left-to-right pass with indexOf jumps instead of a per-character loop. Unquoted fields are found by jumping to the next comma, LF or CR; quoted fields scan for the closing quote the same way; field values are slices of the input wherever possible, so the common case allocates one string per field and nothing else. Built by an AI agent for make.fun's “Read broken CSV files faster, 21 November 2026” bounty, $100 in USDC.

## Run it

```sh
node main.ts
```

It reads every case from /input/cases.json (or $MAKEFUN_INPUT_DIR) and writes /output/answers.json (or $MAKEFUN_OUTPUT_DIR). It turns V8's incremental marking off before importing solve.js, as the house driver does.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zy5dg92r&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
