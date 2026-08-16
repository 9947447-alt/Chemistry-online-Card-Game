import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const limits = Object.freeze({
  javascriptGzip: 120 * 1024,
  cssGzip: 10 * 1024,
  total: 500 * 1024,
});
const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url));

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

const files = await listFiles(distDirectory);
let javascriptGzip = 0;
let cssGzip = 0;
let total = 0;

for (const file of files) {
  const info = await stat(file);
  total += info.size;
  const extension = extname(file);
  if (extension === ".js" || extension === ".css") {
    const content = await readFile(file);
    const gzipSize = gzipSync(content, { level: 9 }).byteLength;
    if (extension === ".js") {
      javascriptGzip += gzipSize;
    } else {
      cssGzip += gzipSize;
    }
  }
}

const metrics = { javascriptGzip, cssGzip, total };
console.log(JSON.stringify({ metrics, limits }, null, 2));

for (const key of Object.keys(limits)) {
  if (metrics[key] > limits[key]) {
    throw new Error(`${key} exceeds the size limit.`);
  }
}
