export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const unitName = body.args && body.args[0];
    const username = body.args && body.args[1];
    const db = env.DB;
    
    if (!unitName) {
      return new Response(JSON.stringify({ success: false, error: "กรุณาระบุชื่อหน่วยวัตถุดิบ" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const name = unitName.trim();
    const user = username || "unknown";
    const lowerUser = user.toLowerCase();
    
    const existing = await db.prepare("SELECT * FROM IngredientUnits WHERE LOWER(UnitName) = ? AND (LOWER(Username) = 'admin' OR LOWER(Username) = ?)")
      .bind(name.toLowerCase(), lowerUser).first();
      
    if (existing) {
      return new Response(JSON.stringify({ success: false, error: "หน่วยวัดนี้มีอยู่ในระบบแล้ว" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    await db.prepare("INSERT INTO IngredientUnits (UnitName, Username) VALUES (?, ?)")
      .bind(name, user).run();
      
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
