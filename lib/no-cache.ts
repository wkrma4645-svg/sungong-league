// 모든 API 라우트에서 사용하는 캐시 방지 헤더
export const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Vercel-CDN-Cache-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
};

export const NO_CACHE_INIT = { headers: NO_CACHE_HEADERS };

// Shortcut for Response.json with no-cache headers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function noCacheJson(data: any, init?: { status?: number }) {
  return Response.json(data, { ...init, headers: NO_CACHE_HEADERS });
}
