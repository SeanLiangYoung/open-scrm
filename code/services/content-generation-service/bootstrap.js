const { Bootstrap } = require('@midwayjs/bootstrap');

Bootstrap.configure({
  appDir: __dirname,
  globalConfig: {
    default: {
      keys: 'content_generation_service_secret_key',
    },
  },
}).run();
