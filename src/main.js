import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().then(async ({ scene }) => {
  if (new URLSearchParams(window.location.search).get('mission') !== 'island-supply') return;
  try {
    const { mountIslandSupply } = await import('./missions/islandSupply/index.js');
    mountIslandSupply(scene.viewer);
  } catch (error) {
    console.error('Island Supply failed; original dashboard remains available:', error);
  }
}).catch((error) => {
  console.error("God's Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  if (loaderStatus) {
    loaderStatus.textContent = `Error: ${describeError(error)}`;
    loaderStatus.style.color = '#ff4444';
  }
});

export { application };
