export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const username = body.args && body.args[0];
    const db = env.DB;
    
    let results = [];
    if (username) {
      const filterUser = username.trim().toLowerCase();
      const { results: rows } = await db.prepare("SELECT * FROM StockMovement WHERE LOWER(Username) = ? ORDER BY CreatedAt DESC").bind(filterUser).all();
      results = rows;
    } else {
      const { results: rows } = await db.prepare("SELECT * FROM StockMovement ORDER BY CreatedAt DESC").all();
      results = rows;
    }
    
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
