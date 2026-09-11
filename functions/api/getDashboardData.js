export async function onRequestPost(context) {
  const { env } = context;
  try {
    const db = env.DB;
    
    // Fetch scents, sweetness, fruitFermentation, and roastedGrainFermentation in parallel for maximum performance
    const [scentsRes, sweetnessRes, fruitRes, grainRes] = await Promise.all([
      db.prepare("SELECT * FROM Scents").all(),
      db.prepare("SELECT * FROM Sweetness").all(),
      db.prepare("SELECT * FROM FruitFermentation").all(),
      db.prepare("SELECT * FROM RoastedGrainFermentation").all()
    ]);

    let scents = scentsRes.results || [];
    if (scents.length === 0) {
      // Seed default scents
      const defaultScents = [
        { name: "ข้าวเหนียว", taste: "- นุ่มละมุน\n- หวานธรรมชาติ\n- ดื่มง่าย", scent: "- กลิ่นข้าวสุกอ่อน" },
        { name: "ข้าวเจ้า", taste: "- สะอาด\n- บอดี้บางกว่าข้าวเหนียว", scent: "- กลิ่นข้าวสุกหอมอ่อนๆ" },
        { name: "ข้าวโพด", taste: "- หวาน", scent: "- กลิ่นเนยอ่อน\n- กลิ่นข้าวโพดติดปลายแอลกอฮอล์" },
        { name: "ข้าวบาร์เลย์", taste: "- มัน คล้ายถั่ว\n- ขมนิดๆ ตอนปลาย", scent: "- กลิ่นธัญพืชคั่ว\n- กลิ่นมอลต์โดยเฉพาะบาร์เลย์งอกจะให้กลิ่นมอลต์ชัดมาก" },
        { name: "ข้าวสาลี", taste: "- นุ่ม\n- ครีมมี่กลิ่นแอลกอฮอล์ต่ำ", scent: "- กลิ่นแป้งขนมปังอบอ่อนๆ" },
        { name: "ข้าวฟ่างแดง", taste: "- มัน แบบเปลือกถั่วผสมความเปรี้ยวคล้ายผลไม้", scent: "- กลิ่นสับปะรด\n- กลิ่นหมักคล้ายเต้าเจี้ยวหมัก" },
        { name: "ข้าวหอมมะลิ", taste: "- รสชาติที่นุ่มนวลและไม่ทำให้เกิดอาการแฮ้งค์", scent: "- หอมข้าวหอมมะลิ ละมุนกว่าข้าวชนิดอื่น" },
        { name: "มันสำปะหลัง", taste: "- สะอาด เป็นกลาง", scent: "- กลิ่นดินและแป้งอ่อน" }
      ];
      for (const item of defaultScents) {
        await db.prepare("INSERT OR IGNORE INTO Scents (Name, Taste, Scent) VALUES (?, ?, ?)")
          .bind(item.name, item.taste, item.scent).run();
      }
      scents = defaultScents;
    } else {
      // Map back keys
      scents = scents.map(row => ({ name: row.Name, taste: row.Taste, scent: row.Scent }));
    }

    // Fetch sweetness
    let sweetness = sweetnessRes.results || [];
    if (sweetness.length === 0) {
      // Seed default sweetness
      const defaultSweetness = [
        { name: "น้ำอ้อย", taste: "- หวานสด สดชื่น", scent: "- กลิ่นหญ้าอ้อย" },
        { name: "กากน้ำตาล", taste: "- หวานเข้ม\n- หนัก\n- ขมหวานแบบน้ำตาลดำ", scent: "- คาราเมล\n- ทอฟฟี่\n- สโมกกี้" },
        { name: "คาราเมลไซรัป", taste: "- หวานเข้ม\n- มีรสไหม้เล็กน้อย", scent: "" },
        { name: "น้ำตาลทรายขาว", taste: "- หวานสะอาดเรียบง่าย", scent: "" },
        { name: "น้ำตาลทรายไม่ฟอก", taste: "- หวานลึก\n- คาราเมล\n- กาแฟ\n- ชะเอม", scent: "- น้ำตาลดำ\n- คาราเมล\n- สโมกกี้" },
        { name: "น้ำผึ้ง", taste: "- หวานธรรมชาติ แตกต่างตามชนิดดอกไม้", scent: "- ดอกไม้\n- ผลไม้\n- ขี้ผึ้ง" }
      ];
      for (const item of defaultSweetness) {
        await db.prepare("INSERT OR IGNORE INTO Sweetness (Name, Taste, Scent) VALUES (?, ?, ?)")
          .bind(item.name, item.taste, item.scent).run();
      }
      sweetness = defaultSweetness;
    } else {
      sweetness = sweetness.map(row => ({ name: row.Name, taste: row.Taste, scent: row.Scent }));
    }

    // Fetch FruitFermentation guidelines
    let fruitFermentation = fruitRes.results || [];
    if (fruitFermentation.length === 0) {
      const defaultFruit = [
        "ผลไม้จับคู่เพื่อเน้นรสชาติและกลิ่นเฉพาะ นุ่ม หวานอ่อน",
        "วัตถิบ ข้าวเหนียว ข้าวสาลี",
        "หมักที่อุณหภูมิต่ำ 18 - 22°C",
        "ยีสต์หมัก เอสเทอร์ต่ำ"
      ];
      for (const val of defaultFruit) {
        await db.prepare("INSERT OR IGNORE INTO FruitFermentation (Guideline) VALUES (?)").bind(val).run();
      }
      fruitFermentation = defaultFruit;
    } else {
      fruitFermentation = fruitFermentation.map(row => row.Guideline);
    }

    // Fetch RoastedGrainFermentation guidelines
    let roastedGrainFermentation = grainRes.results || [];
    if (roastedGrainFermentation.length === 0) {
      const defaultGrain = [
        "บอดี้หนัก กลิ่นลึก",
        "วัตถุดิบ ข้าวบาร์เลย์ ข้าวเจ้า ข้าวโพด",
        "หมักที่อุณหภูมิต่ำ 24 - 30°C",
        "ยีสต์หมัก เอสเทอร์สูง"
      ];
      for (const val of defaultGrain) {
        await db.prepare("INSERT OR IGNORE INTO RoastedGrainFermentation (Guideline) VALUES (?)").bind(val).run();
      }
      roastedGrainFermentation = defaultGrain;
    } else {
      roastedGrainFermentation = roastedGrainFermentation.map(row => row.Guideline);
    }

    return new Response(JSON.stringify({
      scents: scents,
      sweetness: sweetness,
      fruitFermentation: fruitFermentation,
      roastedGrainFermentation: roastedGrainFermentation
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
