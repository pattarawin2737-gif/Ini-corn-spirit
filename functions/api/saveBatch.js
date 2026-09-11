export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const batchObj = body.args && body.args[0];
    
    if (!batchObj) {
      return new Response(JSON.stringify({ error: "ไม่พบข้อมูลแบทช์" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = env.DB;
    const now = new Date().toISOString();
    
    let isNew = false;
    if (!batchObj.ID || batchObj.ID === "" || batchObj.ID === "null" || batchObj.ID === "undefined") {
      batchObj.ID = 'B_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      batchObj.CreatedAt = now;
      isNew = true;
    } else {
      batchObj.ID = batchObj.ID.toString().trim();
    }
    batchObj.UpdatedAt = now;

    if (!isNew) {
      // Fetch existing owner and CreatedAt to verify permission and preserve timestamps
      const existing = await db.prepare("SELECT Username, CreatedAt FROM BatchData WHERE ID = ?").bind(batchObj.ID).first();
      if (existing) {
        if (existing.CreatedAt && !batchObj.CreatedAt) {
          batchObj.CreatedAt = existing.CreatedAt;
        }
        if (existing.Username) {
          const rowOwner = existing.Username.trim().toLowerCase();
          const currentOwner = batchObj.Username ? batchObj.Username.trim().toLowerCase() : '';
          const isAdmin = currentOwner === 'admin' || currentOwner === 'pattarawin';
          if (rowOwner && rowOwner !== currentOwner && !isAdmin) {
            return new Response(JSON.stringify({ error: "ไม่มีสิทธิ์ในการบันทึกทับข้อมูลของผู้อื่น" }), {
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }
        }
      }
    }

    // Save batch using UPSERT
    const rawDataStr = JSON.stringify(batchObj.RawData || {});
    await db.prepare(`
      INSERT INTO BatchData (ID, Title, Date, Status, FermentationDays, FormulaType, RawData, CreatedAt, UpdatedAt, Username)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ID) DO UPDATE SET
        Title = excluded.Title,
        Date = excluded.Date,
        Status = excluded.Status,
        FermentationDays = excluded.FermentationDays,
        FormulaType = excluded.FormulaType,
        RawData = excluded.RawData,
        UpdatedAt = excluded.UpdatedAt
    `).bind(
      batchObj.ID,
      batchObj.Title || "",
      batchObj.Date || "",
      batchObj.Status || "",
      parseInt(batchObj.FermentationDays) || 0,
      parseInt(batchObj.FormulaType) || 0,
      rawDataStr,
      batchObj.CreatedAt || now,
      batchObj.UpdatedAt,
      batchObj.Username || ""
    ).run();

    return new Response(JSON.stringify(batchObj), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

