export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const item = body.args && body.args[0];
    const username = body.args && body.args[1];
    const db = env.DB;
    
    if (!item) {
      return new Response(JSON.stringify({ success: false, error: "ไม่พบข้อมูลที่ต้องการบันทึก" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const id = item.ID || "ING-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const name = item.Name || "";
    const category = item.Category || "อื่นๆ";
    const quantity = parseFloat(item.Quantity) || 0;
    const unit = item.Unit || "กก.";
    const minQuantity = parseFloat(item.MinQuantity) || 0;
    const price = parseFloat(item.Price) || 0;
    const supplier = item.Supplier || "";
    const note = item.Note || "";
    const updatedAt = new Date().toISOString();
    const user = username || "unknown";
    
    await db.prepare(`
      INSERT OR REPLACE INTO IngredientStock (ID, Name, Category, Quantity, Unit, MinQuantity, Price, Supplier, Note, UpdatedAt, Username)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, name, category, quantity, unit, minQuantity, price, supplier, note, updatedAt, user).run();
    
    return new Response(JSON.stringify({ success: true, item: { ID: id, Name: name, Quantity: quantity } }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
