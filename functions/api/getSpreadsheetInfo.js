export async function onRequestPost(context) {
  try {
    return new Response(JSON.stringify({
      id: "cloudflare-d1",
      name: "Cloudflare D1 Database",
      url: "#"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
