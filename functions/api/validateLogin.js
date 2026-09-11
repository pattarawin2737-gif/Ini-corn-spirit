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
      if (String(user.Password).trim() === String(password).trim()) {
        if (Number(user.Approved) === 0) {
          return new Response(JSON.stringify({ success: false, error: "บัญชีของคุณกำลังรอการอนุมัติสิทธิ์จากแอดมินก่อนเข้าใช้งาน" }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ success: true, username: user.Username, role: user.Role || 'User' }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    } else if (lowerUser === 'pattarawin') {
      await db.prepare("INSERT INTO Users (Username, Password, Role, Approved) VALUES (?, ?, ?, ?)").bind('pattarawin', password.trim(), 'admin', 1).run();
      return new Response(JSON.stringify({ success: true, username: 'pattarawin', role: 'admin' }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify({ success: false, error: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
