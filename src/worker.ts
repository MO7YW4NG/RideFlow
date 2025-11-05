type AssetsBinding = { fetch: (request: Request) => Promise<Response> };
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
