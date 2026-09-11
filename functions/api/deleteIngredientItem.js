export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const id = body.args && body.args[0];
    const username = body.args && body.args[1];
    const db = env.DB;
    
    if (!id) {
      return new Response(JSON.stringify({ success: false, error: "ไม่พบรหัสวัตถุดิบที่ต้องการลบ" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    await db.prepare("DELETE FROM IngredientStock WHERE ID = ?").bind(id).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
