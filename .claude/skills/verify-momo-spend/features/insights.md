# Insights

The Insights tab shows where money went by category, average spend by weekday, and six months of money out and in.

## Sub-features

- `insights-legend` one row per category with percent and amount.
- `insights-weekday` seven bars with the biggest day labelled.
- `insights-months` paired out and in bars with the biggest month highlighted.

## How to get to it (user POV)

- Tap the `Insights` tab.
- Tap `See insights` on Home.

## Driving it with momo.py

Preconditions: baseline.

- **Open.** `python3 -I $M tap Insights`, then `python3 -I $M wait "Fridays cost you most" 15`.
- **Legend.** `python3 -I $M texts` lists `Food`, `33%`, `GHS 412.00` and five more rows. Take a screenshot and check that each amount sits on one line in a right-aligned column.
- **Weekday chart.** The label `GHS 94` is above the `Fri` bar and on one line in the screenshot.
- **Monthly chart.** `python3 -I $M scroll`, then `python3 -I $M wait "Aug" 10`. The label `1,610` is above the August pair.
- **Proof.** `python3 -I $M shot artifacts/verify-momo-spend/insights/<name>.png` and `python3 -I $M texts > artifacts/verify-momo-spend/insights/<name>.texts.txt`.

## Gotchas

- A wrapped amount (`GHS` above `412.00`) still passes a text check. Only the screenshot shows it.
