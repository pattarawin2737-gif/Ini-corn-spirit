export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const id = body.args && body.args[0];
    const newStatus = body.args && body.args[1];
    const fermentationDays = body.args && body.args[2];
    const testResult = body.args && body.args[3];
    const username = body.args && body.args[4];
    const expectedSales = body.args && body.args[5];

    if (!id) {
      return new Response(JSON.stringify(false), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = env.DB;
    const now = new Date().toISOString();

    // Check permission
    const existing = await db.prepare("SELECT * FROM BatchData WHERE ID = ?").bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify(false), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (existing.Username && username) {
      const rowOwner = existing.Username.trim().toLowerCase();
      const currentUser = username.trim().toLowerCase();
      if (rowOwner && rowOwner !== currentUser) {
        return new Response(JSON.stringify(false), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Parse and update RawData JSON object
    let rawObj = {};
    try {
      rawObj = JSON.parse(existing.RawData || "{}");
    } catch(e) {}

    rawObj.Status = newStatus;
    if (fermentationDays !== undefined && fermentationDays !== null) {
      rawObj.FermentationDays = fermentationDays;
      
      // Auto recalculate dateFermentEnd in RawData JSON
      if (existing.Date) {
        let startDate;
        if (typeof existing.Date === 'string' && existing.Date.indexOf('-') >= 0) {
          const parts = existing.Date.split('-');
          if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            startDate = new Date(year, month, day);
          }
        }
        if (!startDate || isNaN(startDate.getTime())) {
          startDate = new Date(existing.Date);
        }
        if (startDate && !isNaN(startDate.getTime())) {
          startDate.setDate(startDate.getDate() + fermentationDays);
          const outYear = startDate.getFullYear();
          const outMonth = String(startDate.getMonth() + 1).padStart(2, '0');
          const outDay = String(startDate.getDate()).padStart(2, '0');
          rawObj.dateFermentEnd = `${outYear}-${outMonth}-${outDay}`;
          rawObj.dateEnd = `${outYear}-${outMonth}-${outDay}`;
        }
      }
    }
    if (testResult !== undefined && testResult !== null) {
      rawObj.testResult = testResult;
    }
    if (expectedSales !== undefined && expectedSales !== null && expectedSales !== '') {
      rawObj.expectedSales = parseFloat(expectedSales) || 0;
    }
    rawObj.UpdatedAt = now;

    // Update database row
    await db.prepare(`
      UPDATE BatchData
      SET Status = ?,
          FermentationDays = CASE WHEN ? IS NOT NULL THEN ? ELSE FermentationDays END,
          RawData = ?,
          UpdatedAt = ?
      WHERE ID = ?
    `).bind(
      newStatus,
      fermentationDays !== undefined && fermentationDays !== null ? fermentationDays : null,
      fermentationDays !== undefined && fermentationDays !== null ? fermentationDays : 0,
      JSON.stringify(rawObj),
      now,
      id
    ).run();

    return new Response(JSON.stringify(true), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify(false), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
