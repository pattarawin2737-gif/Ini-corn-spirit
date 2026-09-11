export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const username = body.args && body.args[0];
    const db = env.DB;
    
    let results = [];
    if (username) {
      const filterUser = username.trim().toLowerCase();
      
      // Perform migration check: ONLY write/update if there are actually empty username rows.
      // This prevents running heavy database WRITE transactions on every single read query.
      if (filterUser === 'pattarawin') {
        const checkCount = await db.prepare("SELECT COUNT(*) as count FROM BatchData WHERE Username IS NULL OR Username = ''").first("count");
        if (checkCount > 0) {
          await db.prepare("UPDATE BatchData SET Username = 'pattarawin' WHERE Username IS NULL OR Username = ''").run();
        }
      }
      
      const { results: rows } = await db.prepare("SELECT * FROM BatchData WHERE LOWER(Username) = ?").bind(filterUser).all();
      results = rows;
    } else {
      const { results: rows } = await db.prepare("SELECT * FROM BatchData").all();
      results = rows;
    }
    
    // Format JSON fields
    const formatted = results.map(row => {
      let raw = {};
      try {
        raw = JSON.parse(row.RawData);
      } catch(e) {}
      return {
        ID: row.ID,
        Title: row.Title,
        Date: row.Date,
        Status: row.Status,
        FermentationDays: row.FermentationDays,
        FormulaType: row.FormulaType,
        RawData: raw,
        Username: row.Username
      };
    });
    
    return new Response(JSON.stringify(formatted), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
