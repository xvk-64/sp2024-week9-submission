import * as esbuild from 'esbuild';
import fs from "fs";

fs.copyFileSync("./src/index.html", "./dist/index.html");

const ctx = await esbuild.context({
    entryPoints: ['./src/index.tsx'],
    outdir: './dist',
    bundle: true,
    logLevel: 'info',
    sourcemap: true,
});

await ctx.watch();

const { host, port } = await ctx.serve({
    servedir: './dist/',
});