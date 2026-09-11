export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const username = body.args && body.args[0];
    const db = env.DB;
    
    if (!username) {
      return new Response(JSON.stringify({ success: false, error: "กรุณาระบุ Username ที่ต้องการลบ" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const userLower = username.trim().toLowerCase();
    
    if (userLower === "admin" || userLower === "pattarawin") {
      return new Response(JSON.stringify({ success: false, error: "ไม่สามารถลบผู้ดูแลระบบหลักของโครงการได้" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Cascade delete linked user data to prevent FOREIGN KEY constraint fails
    await db.batch([
      db.prepare("DELETE FROM IngredientUnits WHERE LOWER(Username) = ?").bind(userLower),
      db.prepare("DELETE FROM IngredientStock WHERE LOWER(Username) = ?").bind(userLower),
      db.prepare("DELETE FROM BatchData WHERE LOWER(Username) = ?").bind(userLower),
      db.prepare("DELETE FROM Users WHERE LOWER(Username) = ?").bind(userLower)
    ]);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
