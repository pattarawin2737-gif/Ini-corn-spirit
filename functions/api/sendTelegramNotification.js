export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const message = body.args && body.args[0];
    const customBotToken = body.args && body.args[1];
    const customChatId = body.args && body.args[2];
    const db = env.DB;
    
    if (!message) {
      return new Response(JSON.stringify({ success: false, error: "ไม่มีข้อความแจ้งเตือน" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    let botToken = customBotToken;
    let chatId = customChatId;

    // If not provided in args, lookup from SystemSettings table
    if (!botToken || !chatId) {
      try {
        const { results } = await db.prepare("SELECT Key, Value FROM SystemSettings WHERE Key IN ('telegram_bot_token', 'telegram_chat_id')").all();
        (results || []).forEach(r => {
          if (r.Key === 'telegram_bot_token' && !botToken) botToken = r.Value;
          if (r.Key === 'telegram_chat_id' && !chatId) chatId = r.Value;
        });
      } catch (e) {}
    }

    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "ยังไม่ได้ระบุ Telegram Bot Token หรือ Chat ID กรุณาตั้งค่าในหน้า 'ตั้งค่า Telegram' ก่อน" 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Call Telegram Bot API
    const telegramUrl = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    const payload = {
      chat_id: chatId.trim(),
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    const tgRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const tgData = await tgRes.json();

    if (tgData.ok) {
      return new Response(JSON.stringify({ success: true, messageId: tgData.result.message_id }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Telegram API Error: " + (tgData.description || "ส่งข้อความไม่สำเร็จ") 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
