export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const id = body.args && body.args[0];
    const username = body.args && body.args[1];

    if (!id) {
      return new Response(JSON.stringify(false), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = env.DB;

    // Check permission
    const existing = await db.prepare("SELECT Username FROM BatchData WHERE ID = ?").bind(id).first();
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

    // Delete row
    await db.prepare("DELETE FROM BatchData WHERE ID = ?").bind(id).run();

    return new Response(JSON.stringify(true), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify(false), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
