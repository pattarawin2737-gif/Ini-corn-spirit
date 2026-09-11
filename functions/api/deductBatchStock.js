export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const batchId = body.args && body.args[0];
    const batchTitle = body.args && body.args[1];
    const ingredientsList = body.args && body.args[2]; // array of { name, qty, unit }
    const username = body.args && body.args[3];
    const db = env.DB;
    
    if (!ingredientsList || !Array.isArray(ingredientsList) || ingredientsList.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: "ไม่มีรายการวัตถุดิบที่ต้องตัดสต๊อก" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch all current stock items for user
    const { results: stockItems } = await db.prepare("SELECT * FROM IngredientStock").all();
    if (!stockItems || stockItems.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "ยังไม่มีวัตถุดิบในคลังสินค้า" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const deductedItems = [];
    const notFoundItems = [];
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    for (const item of ingredientsList) {
      const name = (item.name || "").trim();
      const rawQty = parseFloat(item.qty) || 0;
      const unit = (item.unit || "").trim();

      if (!name || rawQty <= 0) continue;

      // Find stock item by exact or partial normalized name
      const stockItem = stockItems.find(s => {
        const sName = (s.Name || "").trim().toLowerCase();
        const iName = name.toLowerCase();
        return sName === iName || sName.includes(iName) || iName.includes(sName);
      });

      if (!stockItem) {
        notFoundItems.push(name);
        continue;
      }

      // Unit conversion check
      let deductQty = rawQty;
      const stockUnit = (stockItem.Unit || "").trim().toLowerCase();
      const itemUnit = unit.toLowerCase();

      // Convert gram <-> kg
      if ((itemUnit === 'กรัม' || itemUnit === 'g' || itemUnit === 'gram') && (stockUnit === 'กก.' || stockUnit === 'kg' || stockUnit === 'กิโลกรัม')) {
        deductQty = rawQty / 1000.0;
      } else if ((itemUnit === 'กก.' || itemUnit === 'kg' || itemUnit === 'กิโลกรัม') && (stockUnit === 'กรัม' || stockUnit === 'g')) {
        deductQty = rawQty * 1000.0;
      }
      // Convert ml <-> Liter
      else if ((itemUnit === 'มล.' || itemUnit === 'ml') && (stockUnit === 'ลิตร' || stockUnit === 'l' || stockUnit === 'liter')) {
        deductQty = rawQty / 1000.0;
      } else if ((itemUnit === 'ลิตร' || itemUnit === 'l') && (stockUnit === 'มล.' || stockUnit === 'ml')) {
        deductQty = rawQty * 1000.0;
      }

      const currentStockQty = parseFloat(stockItem.Quantity) || 0;
      let newStockQty = currentStockQty - deductQty;
      if (newStockQty < 0) newStockQty = 0; // Don't go below 0 or allow 0 with warning

      const noteStr = `ตัดสต๊อกอัตโนมัติจากแบทช์: ${batchTitle || batchId || 'ไม่ระบุชื่อ'}`;

      // Update IngredientStock
      await db.prepare("UPDATE IngredientStock SET Quantity = ?, Note = ?, UpdatedAt = ? WHERE ID = ?")
        .bind(newStockQty, `-${deductQty.toFixed(2)} (${noteStr})`, now, stockItem.ID).run();

      // Record StockMovement
      const movementId = "SM_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      await db.prepare(`
        INSERT INTO StockMovement (ID, IngredientName, MovementType, Quantity, Unit, Date, Note, Username, CreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        movementId,
        stockItem.Name,
        'จ่ายออก',
        deductQty,
        stockItem.Unit || unit,
        todayStr,
        noteStr,
        username || "",
        now
      ).run();

      deductedItems.push({
        name: stockItem.Name,
        deducted: deductQty,
        unit: stockItem.Unit,
        remaining: newStockQty
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      deductedCount: deductedItems.length,
      deductedItems: deductedItems,
      notFoundItems: notFoundItems
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
