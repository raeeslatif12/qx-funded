import "dotenv/config";
import app from "./index.mjs";

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`QXT API listening on http://localhost:${port}`);
});
