# Island Supply

Open the app with `?mission=island-supply` appended to its URL. Without this parameter the original dashboard is unchanged.

Three training hubs near Hawaii, six fictional units, 400 supply, cargo reservations, repeat deliveries, one unloading berth per destination, safe recall, follow/overview, local saves, pause/reset, and a responsive panel.

All units, cargo, operational hub roles, routes, and accelerated travel times are fictional. SIM entities use a separate Cesium data source; live contacts are not commanded. Routes are illustrative, not suitable for navigation. No new datasets, models, API keys or network feeds are added. Existing imagery/provider configuration and terms still apply; upstream third-party data is not commercially cleared by this feature.

Run normal upstream setup, then open the app URL with the query parameter. Run mission tests with `node --test src/missions/islandSupply/simulation.test.mjs`.

Eight isolated simulation tests and syntax checks passed during preparation. Full upstream install/build, browser integration, actual Cesium behavior, iPhone testing and deployment are not verified. Hidden tabs pause; no offline backlog. Local storage key: gev-island-supply-v1. Reset affects this mission only.
