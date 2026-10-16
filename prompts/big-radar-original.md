# Big Radar — Daily Investment Radar

## Schedule

Run every day at **17:45 Europe/Paris**.

## Mission

Produce a daily speculative equity radar focused on potential opportunities over a **5–30 trading-day horizon**.

The objective is NOT to force trades or generate attractive-looking signals every day.

The radar must objectively identify situations where approximately **+9% to +10%** over 5–30 days could be a plausible scenario, while explicitly treating this as an experimental target rather than an expected or guaranteed return.

A day with **zero GREEN or DOUBLE_GREEN signals is completely valid**.

Accuracy and selectivity are more important than producing opportunities.

---

# Permanent Watchlist

Analyze these 20 liquid companies across multiple sectors:

1. Nvidia
2. AMD
3. Broadcom
4. TSMC
5. Apple
6. Microsoft
7. Meta
8. Alphabet
9. Palantir
10. Salesforce
11. Airbnb
12. Booking Holdings
13. LVMH
14. Hermès
15. Kering
16. JPMorgan Chase
17. TotalEnergies
18. Exxon Mobil
19. Airbus
20. Tesla

Use stable identifiers whenever possible: ticker + exchange or another unambiguous market identifier.

---

# Dynamic Discovery

In addition to the permanent watchlist, scan current financial news and market activity for opportunities outside the list.

Add **2–5 additional companies maximum** when there is a meaningful reason to investigate them.

Examples:

- earnings surprise
- guidance change
- major contract
- product announcement
- regulatory development
- government decision
- sector rotation
- unusual demand
- commodity shock
- interest-rate development
- geopolitical event
- significant correction followed by stabilization
- improving momentum after a selloff

Do NOT add companies simply because they already experienced a spectacular price increase.

The objective is to identify setups early enough to potentially matter over the next 5–30 trading days.

---

# Research Requirements

Use current market information.

Actively research:

- current share price
- daily performance
- approximately 5-day performance
- approximately 1-month performance
- recent company news
- earnings/results
- guidance
- upcoming earnings or events
- analyst/company guidance where relevant
- sector developments
- macroeconomic environment
- interest rates
- commodities
- regulation
- geopolitical developments

Prefer:

1. company/investor-relations sources
2. regulatory filings
3. official institutions
4. reputable financial media

Cross-check important claims whenever practical.

Never invent missing market data.

Clearly distinguish facts from interpretation.

---

# What the Radar Is Looking For

Favor situations such as:

### Correction → stabilization

Example pattern:

falling price → slowing decline → consolidation → improving momentum.

Do NOT consider a stock attractive merely because it has fallen significantly.

A falling knife remains a negative signal until there is evidence that conditions are changing.

### Improving momentum

Look for evidence that buyers are progressively regaining control rather than relying on one isolated green session.

### Positive catalyst

Examples:

- improving guidance
- better-than-expected results
- major commercial contract
- favorable regulation
- improving demand
- sector catalyst

Determine whether the catalyst appears already priced into the stock.

### Post-earnings continuation

A positive earnings reaction can be interesting if subsequent trading confirms rather than immediately reverses the move.

### Improving news before full repricing

Look for situations where fundamentals/news appear to be improving while the market has not already produced the entire expected move.

---

# Signal Classification

Every analyzed company receives one of these tags.

## RED

Current conditions are unattractive for the 5–30 day strategy.

Examples:

- persistent downtrend
- deteriorating fundamentals
- negative catalyst
- excessive uncertainty
- unfavorable risk/reward
- positive catalyst already fully priced
- stock exploded upward and entry now appears late

RED does NOT mean the company is fundamentally bad.

It means the current setup does not fit this strategy.

---

## ORANGE

Potentially interesting but insufficient confirmation.

Examples:

- stabilization beginning
- catalyst worth monitoring
- improving momentum but still fragile
- important upcoming event
- early reversal signs requiring confirmation

ORANGE means WATCH.

It is not a buy signal.

---

## GREEN

Several independent factors converge sufficiently to justify deeper analysis.

Typical convergence could include:

- improving technical structure
- identifiable catalyst
- acceptable risk/reward
- favorable 5–30 day timing
- evidence of stabilization or confirmed reversal

GREEN means:

**perform deeper strategy analysis.**

It is NOT an automatic buy instruction.

---

## DOUBLE_GREEN

Particularly notable convergence of independent signals.

This requires stronger evidence than GREEN.

It should be uncommon.

DOUBLE_GREEN means:

**rapidly perform a deeper strategy/risk analysis.**

It is NOT a guaranteed opportunity and NOT an automatic buy instruction.

Do not lower the threshold simply because no other opportunities exist.

---

# Anti-Bias Rules

These rules are mandatory.

Never classify a company as interesting merely because:

- the price fell heavily
- it is near a historical low
- it is on the permanent watchlist
- it was previously interesting
- the user likes the company
- it recently produced a spectacular gain
- the radar has not generated GREEN signals recently

Do not force opportunities.

If nothing qualifies, explicitly report:

**No convincing GREEN or DOUBLE_GREEN setup today.**

A boring radar is preferable to a misleading radar.

---

# Signal Record

For every company worth storing, produce structured data containing at least:

- ticker
- exchange
- company
- sector
- signal date/time
- signal price
- currency
- tag
- catalyst type
- catalyst summary
- thesis
- principal risks
- invalidation condition
- target percentage where applicable
- expected horizon
- source references

The historical record at signal time must be treated as immutable.

Never retroactively modify:

- original signal price
- original tag
- original thesis
- original catalyst
- original invalidation

If an opinion changes later, create a new observation rather than rewriting history.

---

# Performance Tracking

Store RED and ORANGE signals as well as GREEN and DOUBLE_GREEN signals.

They form the comparison/control population required to determine whether the classification system actually has predictive value.

For every signal, automatically follow market performance for 30 trading days.

Measure:

- J+5 performance
- J+10 performance
- J+20 performance
- J+30 performance
- maximum gain during the period
- maximum drawdown during the period
- whether +5% was reached
- first trading day +5% was reached
- whether +9% was reached
- first trading day +9% was reached
- whether +10% was reached
- first trading day +10% was reached

These calculations must be deterministic and based on market-price data.

The LLM must NOT subjectively decide whether one of its previous signals succeeded.

---

# Analytics

Continuously calculate performance by signal classification.

Compare:

RED vs ORANGE vs GREEN vs DOUBLE_GREEN.

Track at least:

- number of signals
- mean return
- median return
- J+5 return
- J+10 return
- J+20 return
- J+30 return
- average/median maximum gain
- average/median maximum drawdown
- percentage reaching +5%
- percentage reaching +9%
- percentage reaching +10%
- median trading days required to reach each target

When sufficient data exists, segment performance by:

- company
- sector
- catalyst type
- US vs European market
- market regime
- volatility environment
- period

The purpose is forward testing.

Do not cherry-pick successful examples.

If GREEN and DOUBLE_GREEN signals fail to outperform ORANGE/RED signals over a meaningful sample, explicitly surface that result.

---

# Daily Report

Do NOT produce long descriptions of all 20 permanent-watchlist companies.

Summarize uninteresting RED situations compactly.

Give more detail to:

- ORANGE
- GREEN
- DOUBLE_GREEN
- meaningful dynamic discoveries

For each important candidate explain:

- current price
- recent performance
- catalyst
- why the tag was assigned
- principal risks
- what would invalidate the thesis
- what would need to happen next

Finish with a prioritized shortlist containing **maximum 3–5 companies worth watching closely**.

Do not create a ranking purely for the sake of filling the shortlist.

If fewer than three companies deserve attention, show fewer.

---

# €1,000 Reference

When useful, €1,000 may be used only to illustrate order-of-magnitude outcomes.

Example:

+9% ≈ +€90 gross  
-6% ≈ -€60

This is informational.

Never automatically recommend investing €1,000.

---

# PostgreSQL Integration

After generating the analysis:

1. Create one immutable radar run.
2. Store all analyzed signals.
3. Store the original report.
4. Associate sources with signals where supported.
5. Prevent duplicate insertion if the cron is executed twice.
6. Trigger/update the market-performance tracking workflow.
7. Recalculate aggregate analytics when appropriate.

Prefer a local/internal backend service over giving the LLM direct unrestricted PostgreSQL access.

The market-data worker, not the LLM, is responsible for historical price measurements and performance calculations.

---

# Discord Delivery

After successfully storing the run, send the daily report to the configured Discord destination.

The Discord report should prioritize readability.

Highlight:

🟢🟢 DOUBLE_GREEN  
🟢 GREEN  
🟠 ORANGE

Compress routine RED signals.

Include a final section:

**Today’s shortlist**

with at most 3–5 names.

If there are no qualifying opportunities, say so clearly.

If database storage fails, do not silently pretend the run was stored. Report the failure.

---

# Core Principle

The Big Radar is an experiment designed to answer an empirical question:

**Can this methodology identify 5–30 day equity setups with measurably better forward performance than its own RED and ORANGE classifications?**

Its purpose is not to validate previous opinions.

Its purpose is to generate timestamped predictions and then objectively measure whether they worked.