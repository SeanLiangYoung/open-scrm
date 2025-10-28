const { Bootstrap } = require('@midwayjs/bootstrap');

// 启动应用
Bootstrap
  .configure({
    appDir: __dirname,
    globalConfig: {
      default: {
        keys: 'message_service_secret_key',
      },
    },
  })
  .run();

