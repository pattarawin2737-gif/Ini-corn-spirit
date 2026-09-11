export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const id = body.args && body.args[0];
    const adjustType = body.args && body.args[1];
    const amount = body.args && body.args[2];
    const note = body.args && body.args[3];
    const username = body.args && body.args[4];
    const db = env.DB;
    
    if (!id || !adjustType) {
      return new Response(JSON.stringify({ success: false, error: "ข้อมูลที่จำเป็นไม่ครบถ้วน" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const currentItem = await db.prepare("SELECT Name, Quantity, Unit FROM IngredientStock WHERE ID = ?").bind(id).first();
    if (!currentItem) {
      return new Response(JSON.stringify({ success: false, error: "ไม่พบวัตถุดิบที่ต้องการปรับปรุง" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const currentQty = parseFloat(currentItem.Quantity) || 0;
    const adjustAmount = parseFloat(amount) || 0;
    let newQty = currentQty;
    
    if (adjustType === 'add') {
      newQty = currentQty + adjustAmount;
    } else if (adjustType === 'subtract') {
      newQty = currentQty - adjustAmount;
      if (newQty < 0) newQty = 0;
    } else if (adjustType === 'set') {
      newQty = adjustAmount;
    }
    
    const logNote = (adjustType === 'add' ? "+" : adjustType === 'subtract' ? "-" : "=") + adjustAmount + " (" + (note || "ปรับปรุงสต๊อก") + ")";
    const updatedAt = new Date().toISOString();
    
    // 1. อัปเดตจำนวนคงเหลือในคลัง
    await db.prepare("UPDATE IngredientStock SET Quantity = ?, Note = ?, UpdatedAt = ? WHERE ID = ?")
      .bind(newQty, logNote, updatedAt, id).run();
      
    // 2. บันทึกประวัติการเคลื่อนไหวอัตโนมัติ (Automated Movement Log)
    const movementId = "SM_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const mType = adjustType === 'add' ? 'รับเข้า' : (adjustType === 'subtract' ? 'จ่ายออก' : 'ปรับปรุงยอด');
    const todayStr = updatedAt.split('T')[0];
    
    await db.prepare(`
      INSERT INTO StockMovement (ID, IngredientName, MovementType, Quantity, Unit, Date, Note, Username, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      movementId,
      currentItem.Name,
      mType,
      adjustAmount,
      currentItem.Unit || "",
      todayStr,
      note || "ปรับปรุงสต๊อก",
      username,
      updatedAt
    ).run();
      
    return new Response(JSON.stringify({ success: true, newQuantity: newQty }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
