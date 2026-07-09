// Shim for SvelteKit's virtual '$env/dynamic/private' when running under bare node
// (integration tests). Same contract: `env` mirrors the process environment.
export const env = process.env;
