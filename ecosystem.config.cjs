module.exports = {
  apps: [
    {
      name: 'adonis-web-server',
      script: 'build/bin/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      node_args: '--max-old-space-size=384',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'adonis-queue-worker',
      script: 'build/ace.js',
      args: 'queue:work --concurrency=3',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      node_args: '--max-old-space-size=192',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}