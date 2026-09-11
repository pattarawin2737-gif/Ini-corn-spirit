export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const id = body.args && body.args[0];
    const username = body.args && body.args[1];
    const db = env.DB;
    
    if (!id) {
      return new Response(JSON.stringify({ success: false, error: "กรุณาระบุ ID ของรายการเคลื่อนไหวที่ต้องการลบ" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1. ดึงข้อมูลรายการเคลื่อนไหวที่จะลบ
    const movement = await db.prepare("SELECT * FROM StockMovement WHERE ID = ?").bind(id).first();
    if (!movement) {
      return new Response(JSON.stringify({ success: false, error: "ไม่พบข้อมูลรายการเคลื่อนไหวนี้ในระบบ" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ตรวจสอบสิทธิ์เจ้าของรายการ
    if (movement.Username && username) {
      const rowOwner = movement.Username.trim().toLowerCase();
      const currentUser = username.trim().toLowerCase();
      if (rowOwner && rowOwner !== currentUser) {
        return new Response(JSON.stringify({ success: false, error: "คุณไม่มีสิทธิ์ในการลบรายการนี้" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. ค้นหาวัตถุดิบในคลังสต๊อก (อ้างอิงตามชื่อและ Username)
    const ingredientNameLower = movement.IngredientName.trim().toLowerCase();
    const userLower = username ? username.trim().toLowerCase() : "";
    
    const ingredient = await db.prepare(
      "SELECT * FROM IngredientStock WHERE LOWER(Name) = ? AND LOWER(Username) = ?"
    ).bind(ingredientNameLower, userLower).first();

    // 3. ทำการคำนวณและปรับสต๊อกกลับคืน (Rollback stock)
    if (ingredient) {
      const currentQty = parseFloat(ingredient.Quantity) || 0;
      const movementQty = parseFloat(movement.Quantity) || 0;
      let rolledBackQty = currentQty;

      if (movement.MovementType === 'รับเข้า') {
        // หากรายการก่อนหน้านี้คือรับเข้า เมื่อลบประวัติออก สต๊อกจริงต้องลดลง
        rolledBackQty = currentQty - movementQty;
        if (rolledBackQty < 0) rolledBackQty = 0;
      } else if (movement.MovementType === 'จ่ายออก') {
        // หากรายการก่อนหน้านี้คือจ่ายออก เมื่อลบประวัติออก สต๊อกจริงต้องบวกกลับเข้ามา
        rolledBackQty = currentQty + movementQty;
      }

      const now = new Date().toISOString();
      const logNote = "ยกเลิกประวัติ " + (movement.MovementType === 'รับเข้า' ? "-" : "+") + movementQty + " (" + (movement.Note || "") + ")";
      
      // อัปเดตปริมาณคงเหลือในคลัง
      await db.prepare("UPDATE IngredientStock SET Quantity = ?, Note = ?, UpdatedAt = ? WHERE ID = ?")
        .bind(rolledBackQty, logNote, now, ingredient.ID).run();
    }

    // 4. ลบประวัติเคลื่อนไหวสต๊อกออกจากตาราง StockMovement
    await db.prepare("DELETE FROM StockMovement WHERE ID = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
