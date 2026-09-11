export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const username = body.args && body.args[0];
    const db = env.DB;
    
    // Create table if not exists (safeguard)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS SystemSettings (
        Key TEXT PRIMARY KEY,
        Value TEXT NOT NULL,
        Username TEXT,
        UpdatedAt TEXT NOT NULL
      )
    `).run();

    let query = "SELECT Key, Value FROM SystemSettings";
    let rows;
    if (username) {
      const { results } = await db.prepare(query + " WHERE Username = ? OR Username IS NULL OR Username = ''").bind(username).all();
      rows = results;
    } else {
      const { results } = await db.prepare(query).all();
      rows = results;
    }
    
    const settings = {};
    (rows || []).forEach(r => {
      settings[r.Key] = r.Value;
    });
    
    return new Response(JSON.stringify({ success: true, settings: settings }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString(), settings: {} }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
