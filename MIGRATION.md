# Migrace na 11 MAX

- `state.version` se zvýší na 11.
- Každý projekt dostane nové bezpečné defaulty: `quotes: []`, `jobs: []`, `targetMonthly: 0`, `lastSalesCoach: null`.
- Existující leads/products/calendar/mediaCatalog/learning/activity/draft se zachovávají.
- Cloud snapshot key zůstává `business-control-one-8.1` kvůli zpětné kompatibilitě existujících snapshotů.
- Žádná databázová DDL migrace není nutná pro lokální Sales/Jobs vrstvu.
