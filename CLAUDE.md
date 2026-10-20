# Project rules

- Every pull request must target the `dev` branch, never `main`.
- Every element a flow, test or verification run touches gets a camelCase `testID` (see `maestro/README.md` for the naming). Add one when you add such an element.
- Before connecting real data (SMS, SQLite, ledger), read `docs/handoff.md` for what is a stand-in and where it plugs in, and `CHANGELOG.md` for what changed. Update both when you replace a stand-in or change behaviour.
