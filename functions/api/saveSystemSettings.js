export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const settings = body.args && body.args[0];
    const username = body.args && body.args[1];
    const db = env.DB;
    
    if (!settings || typeof settings !== 'object') {
      return new Response(JSON.stringify({ success: false, error: "ข้อมูลการตั้งค่าไม่ถูกต้อง" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Create table if not exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS SystemSettings (
        Key TEXT PRIMARY KEY,
        Value TEXT NOT NULL,
        Username TEXT,
        UpdatedAt TEXT NOT NULL
      )
    `).run();

    const updatedAt = new Date().toISOString();
    
    for (const [key, val] of Object.entries(settings)) {
      const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
      await db.prepare(`
        INSERT INTO SystemSettings (Key, Value, Username, UpdatedAt)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(Key) DO UPDATE SET
          Value = excluded.Value,
          Username = excluded.Username,
          UpdatedAt = excluded.UpdatedAt
      `).bind(key, valStr, username || "", updatedAt).run();
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
