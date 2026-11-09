import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application
  .start()
  .then(async ({ scene }) => {
    if (
      new URLSearchParams(window.location.search).get('mission') !==
      'island-supply'
    )
      return;
    let mission = null;
    let cancelled = false;
    let unsubscribe = () => {};
    function disposeMission() {
      cancelled = true;
      const mounted = mission;
      mission = null;
      unsubscribe();
      mounted?.destroy();
    }
    unsubscribe = application.subscribe(({ status }) => {
      if (['destroying', 'destroyed', 'failed'].includes(status))
        disposeMission();
    });
    if (cancelled) {
      unsubscribe();
      return;
    }
    try {
      const { mountIslandSupply } =
        await import('./missions/islandSupply/index.js');
      if (cancelled || application.getState().status !== 'ready') {
        disposeMission();
        return;
      }
      mission = mountIslandSupply(scene.viewer);
      // A mount can synchronously cause application teardown via its observers.
      if (cancelled) disposeMission();
    } catch (error) {
      disposeMission();
      console.error(
        'Island Supply failed; original dashboard remains available:',
        error,
      );
    }
  })
  .catch((error) => {
    console.error("God's Eye View initialization failed:", error);
    const loaderStatus = document.querySelector(
      '#loading-screen .loader-status',
    );
    if (loaderStatus) {
      loaderStatus.textContent = `Error: ${describeError(error)}`;
      loaderStatus.style.color = '#ff4444';
    }
  });

export { application };
