import "dotenv/config";

import { createApp } from "./app";

const app = createApp();

const port = Number(process.env.SERVER_PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});
