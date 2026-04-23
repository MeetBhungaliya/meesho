module.exports = {
  apps: [
    {
      name: 'adonis-web',
      script: './build/bin/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'adonis-worker',
      script: './build/ace',
      args: 'queue:listen',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' }
    }
  ]
}