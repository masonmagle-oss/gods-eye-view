# Island Supply: timed contracts

Launch with `?mission=island-supply`. Normal dashboard startup is unchanged. All units, cargo, hub roles, routes and accelerated travel times are fictional. Live contacts are not player-controlled.

## Contracts
- Emergency Relief: 100 cargo per hub in 420 active seconds; North needs 30 by 120s and East needs 30 by 180s. Starts with 1,200 credits and 80 fuel. Reimbursement: 3 credits per delivered cargo.
- Rapid Response: 80 per hub in 300 active seconds. Starts with 900 credits, 70 fuel; pays 4 credits per cargo.
- Lean Operations: 80 per hub in 600 active seconds, finishing with at least 1,000 credits and 20 fuel. Starts with 1,200 credits, 80 fuel; pays 4 per cargo.

Aircraft cost 90 credits and reserve 18 fuel per full round trip, carrying 15 cargo. Vessels cost 55 credits and reserve 10 fuel, carrying 30. Purchase 20 fuel for 60 credits. Fees/fuel are paid before departure; no airborne fuel depletion or debt. Unloading deposits delivery reimbursement. Auto-repeat never bypasses costs and stops launching when that hub's cargo goal is met. If a repeat cannot afford departure, it waits idle; purchase fuel and dispatch it again.

Win by satisfying the selected contract. Gold requires finishing with starting cash or more and 20 fuel; silver requires completion before 80% of the time limit; otherwise bronze. Lose for a missed emergency deadline, overall timeout, unrecoverable cargo misallocation, or an idle fleet without a financially feasible dispatch/refuel plan. Zero cash alone is not fatal while reimbursement is in transit. Lean victory can still be completed by buying missing fuel after cargo delivery.

Mission starts paused, and reloads paused. Pausing or leaving the page does not consume mission time. Won/lost missions freeze and reject spending. New Contract requires confirmation. A separate `gev-island-supply-v2` save leaves the old untimed save intact; no migration of an already-progressing untimed mission is attempted.

The existing core and eight original tests remain unchanged. The new rules layer has 18 isolated Node tests, including a demonstrated winning strategy for each contract. Command: `node --test src/missions/islandSupply/rules.test.mjs`. Full upstream build, browser interaction, CI, mobile usability and retention are not verified here. Numbers are initial balance values, not production playtest results. Existing imagery and third-party dataset terms remain applicable; this update does not commercially clear the upstream repository.
