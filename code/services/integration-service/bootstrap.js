const { Bootstrap } = require('@midwayjs/bootstrap');
const { Application } = require('@midwayjs/koa');

// 启动应用
Bootstrap
  .configure({
    appDir: __dirname,
    globalConfig: {
      default: {
        keys: 'integration_service_secret_key',
      },
    },
  })
  .run();

