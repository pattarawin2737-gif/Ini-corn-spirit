export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const ingredientId = body.args && body.args[0];
    const movementType = body.args && body.args[1]; // 'รับเข้า' / 'จ่ายออก'
    const quantity = parseFloat(body.args && body.args[2]) || 0;
    const date = body.args && body.args[3]; // วันเดือนปี YYYY-MM-DD
    const note = body.args && body.args[4] || "";
    const username = body.args && body.args[5];
    const db = env.DB;
    
    if (!ingredientId || !movementType || quantity <= 0 || !date) {
      return new Response(JSON.stringify({ success: false, error: "ข้อมูลไม่ครบถ้วนหรือจำนวนไม่ถูกต้อง" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const item = await db.prepare("SELECT * FROM IngredientStock WHERE ID = ?").bind(ingredientId).first();
    if (!item) {
      return new Response(JSON.stringify({ success: false, error: "ไม่พบวัตถุดิบที่ต้องการปรับปรุงในคลัง" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const currentQty = parseFloat(item.Quantity) || 0;
    let newQty = currentQty;
    if (movementType === 'รับเข้า') {
      newQty = currentQty + quantity;
    } else if (movementType === 'จ่ายออก') {
      newQty = currentQty - quantity;
      if (newQty < 0) newQty = 0; // ป้องกันสต๊อกติดลบ
    }

    const now = new Date().toISOString();
    const movementId = "SM_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

    // 1. บันทึกข้อมูลการเคลื่อนไหว (Transaction Log)
    await db.prepare(`
      INSERT INTO StockMovement (ID, IngredientName, MovementType, Quantity, Unit, Date, Note, Username, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(movementId, item.Name, movementType, quantity, item.Unit, date, note, username, now).run();

    // 2. อัปเดตจำนวนคงเหลือจริงในคลังสินค้า
    const logNote = (movementType === 'รับเข้า' ? "+" : "-") + quantity + " (" + (note || "ปรับสต๊อกจากประวัติ") + ")";
    await db.prepare("UPDATE IngredientStock SET Quantity = ?, Note = ?, UpdatedAt = ? WHERE ID = ?")
      .bind(newQty, logNote, now, ingredientId).run();

    return new Response(JSON.stringify({ success: true, newQuantity: newQty }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
