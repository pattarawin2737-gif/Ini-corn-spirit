export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const unitName = body.args && body.args[0];
    const username = body.args && body.args[1];
    const db = env.DB;
    
    if (!unitName) {
      return new Response(JSON.stringify({ success: false, error: "กรุณาระบุหน่วยวัดที่ต้องการลบ" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const name = unitName.trim();
    const user = username || "unknown";
    const lowerUser = user.toLowerCase();
    
    const existing = await db.prepare("SELECT * FROM IngredientUnits WHERE UnitName = ? AND LOWER(Username) = ?")
      .bind(name, lowerUser).first();
      
    if (!existing) {
      return new Response(JSON.stringify({ success: false, error: "ไม่พบหน่วยวัดหรือไม่มีสิทธิ์ในการลบรายการนี้" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (existing.Username.toLowerCase() === 'admin') {
      return new Response(JSON.stringify({ success: false, error: "ไม่สามารถลบหน่วยวัดที่เป็นของระบบเริ่มต้นได้" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    await db.prepare("DELETE FROM IngredientUnits WHERE UnitName = ? AND Username = ?")
      .bind(name, existing.Username).run();
      
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
