import { buildServer } from './server';
import { env } from './env';

const app = buildServer();
app.listen(env.PORT, () => {
  console.log(`API on http://0.0.0.0:${env.PORT}`);
});
