import {build} from "esbuild";
import fs from "fs";

await build({
    entryPoints: ['./src/index.tsx'],
    bundle: true,
    outdir: './dist',
    format: 'esm',
});

fs.copyFileSync("./src/index.html", "./dist/index.html");