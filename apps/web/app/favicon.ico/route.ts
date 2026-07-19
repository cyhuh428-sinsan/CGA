const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#f3f5f7" />
  <circle cx="32" cy="32" r="20" fill="#5f84ad" />
  <circle cx="25" cy="29" r="3" fill="#ffffff" />
  <circle cx="39" cy="29" r="3" fill="#ffffff" />
  <path d="M24 39c2.8 3.6 13.2 3.6 16 0" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-width="3" />
</svg>
`.trim();

export async function GET() {
  return new Response(faviconSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
