import { httpServer } from "./api/routes";

const PORT = process.env.PORT ?? 3000;

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
