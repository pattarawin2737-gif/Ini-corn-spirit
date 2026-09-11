export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const username = body.args && body.args[0];
    const password = body.args && body.args[1];
    
    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = env.DB;
    const lowerUser = username.trim().toLowerCase();
    
    // Check if user exists
    const user = await db.prepare("SELECT * FROM Users WHERE LOWER(Username) = ?").bind(lowerUser).first();
    if (user) {
      return new Response(JSON.stringify({ success: false, error: "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Insert new user with default 'User' role and approved = 0 (needs admin approval)
    await db.prepare("INSERT INTO Users (Username, Password, Role, Approved) VALUES (?, ?, ?, ?)").bind(username.trim(), password.trim(), 'User', 0).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
