type AssetsBinding = { fetch: (request: Request) => Promise<Response> };

export default {
  async fetch(request: Request, env: { ASSETS: AssetsBinding; GOOGLE_MAPS_API_KEY?: string }) {
    const url = new URL(request.url);
    // 提供 API key 的端點，從 Workers secret 讀取
    if (url.pathname === '/api/google-maps-key') {
      return new Response(JSON.stringify({ apiKey: env.GOOGLE_MAPS_API_KEY || '' }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
