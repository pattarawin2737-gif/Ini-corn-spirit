export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const filter = body.args && body.args[0];
    const db = env.DB;
    
    let query = "SELECT Username, Password, Role, Approved FROM Users";
    if (filter === "admin") {
      query = "SELECT Username, Password, Role, Approved FROM Users WHERE LOWER(Role) = 'admin'";
    }
    
    const { results } = await db.prepare(query).all();
    
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
