import * as esbuild from 'esbuild';

const ctx = await esbuild.context({
    entryPoints: ['./src/index.tsx'],
    outdir: './dist',
    bundle: true,
    logLevel: 'info'
});

await ctx.watch();

const { host, port } = await ctx.serve({
    servedir: './dist/',
});