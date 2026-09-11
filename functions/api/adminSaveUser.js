export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const username = body.args && body.args[0];
    const password = body.args && body.args[1];
    const role = body.args && body.args[2];
    const approved = body.args && body.args[3];
    const db = env.DB;
    
    if (!username) {
      return new Response(JSON.stringify({ success: false, error: "กรุณาระบุ Username" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const userLower = username.trim().toLowerCase();
    
    const existing = await db.prepare("SELECT * FROM Users WHERE LOWER(Username) = ?").bind(userLower).first();
    
    if (existing) {
      if (password !== undefined && password !== null && String(password).trim() !== "") {
        await db.prepare("UPDATE Users SET Password = ? WHERE LOWER(Username) = ?")
          .bind(String(password).trim(), userLower).run();
      }
      if (role !== undefined && role !== null && String(role).trim() !== "") {
        await db.prepare("UPDATE Users SET Role = ? WHERE LOWER(Username) = ?")
          .bind(String(role).trim(), userLower).run();
      }
      if (approved !== undefined && approved !== null) {
        await db.prepare("UPDATE Users SET Approved = ? WHERE LOWER(Username) = ?")
          .bind(Number(approved), userLower).run();
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      if (!password) {
        return new Response(JSON.stringify({ success: false, error: "กรุณาระบุรหัสผ่าน" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      const newRole = role || "User";
      const newApproved = (approved !== undefined && approved !== null) ? Number(approved) : 1;
      
      await db.prepare("INSERT INTO Users (Username, Password, Role, Approved) VALUES (?, ?, ?, ?)")
        .bind(username.trim(), password.trim(), newRole, newApproved).run();
        
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
