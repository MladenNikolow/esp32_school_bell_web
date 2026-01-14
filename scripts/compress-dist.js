import fs from "fs";
import { promises as fsp } from "fs";
import { createGzip } from "zlib";
import { pipeline } from "stream";
import { promisify } from "util";
import { join } from "path";

const pipe = promisify(pipeline);
const distDir = "./dist";

async function compressAndDelete(filePath) {
  const gzipPath = filePath + ".gz";

  // Compress file
  await pipe(
    fs.createReadStream(filePath),
    createGzip({ level: 9 }),
    fs.createWriteStream(gzipPath)
  );

  console.log("Compressed:", gzipPath);

  // Delete original file
  await fsp.unlink(filePath);
  console.log("Deleted original:", filePath);
}

async function walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(fullPath);
    } else {
      if (
        fullPath.endsWith(".html") ||
        fullPath.endsWith(".js") ||
        fullPath.endsWith(".css") ||
        fullPath.endsWith(".json") ||
        fullPath.endsWith(".svg") ||
        fullPath.endsWith(".png") ||
        fullPath.endsWith(".jpg") ||
        fullPath.endsWith(".jpeg")
      ) {
        await compressAndDelete(fullPath);
      }
    }
  }
}

walk(distDir)
  .then(() => console.log("Compression complete — originals removed"))
  .catch(err => console.error("Error:", err));
