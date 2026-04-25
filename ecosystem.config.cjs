module.exports = {
  apps: [
    {
      name: 'adonis-web-server',
      script: 'npm',
      args: 'run dev',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'adonis-queue-worker',
      script: 'npm',
      args: 'run worker:run',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}