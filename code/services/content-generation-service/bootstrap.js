const { Bootstrap } = require('@midwayjs/bootstrap');
const { loadMonorepoEnv } = require('./load-monorepo-env.cjs');

loadMonorepoEnv();

Bootstrap.configure({
  appDir: __dirname,
  globalConfig: {
    default: {
      keys: 'content_generation_service_secret_key',
    },
  },
}).run();
