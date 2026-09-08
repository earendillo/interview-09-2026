import { createServer } from './app/server';

const port = Number(process.env.PORT ?? 3333);

createServer().listen(port, () => {
  console.log(`API listening on http://localhost:${port}/api`);
});
