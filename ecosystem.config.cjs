module.exports = {
  apps: [
    {
      name: 'adonis-web-server',
      script: 'build/bin/server.js',
      node_args: '--max-old-space-size=320',
      max_memory_restart: '400M',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      min_uptime: '10s',
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'adonis-queue-worker',
      script: 'build/ace.js',
      args: 'queue:work --concurrency=2',
      node_args: '--max-old-space-size=160',
      max_memory_restart: '200M',
      kill_timeout: 15000,
      min_uptime: '10s',
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
