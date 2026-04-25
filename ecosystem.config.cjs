module.exports = {
  apps: [
    {
      name: 'adonis-web-server',
      script: 'build/bin/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'adonis-queue-worker',
      script: 'build/ace.js',
      interpreter: 'node',
      args: 'queue:work --concurrency=3',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
