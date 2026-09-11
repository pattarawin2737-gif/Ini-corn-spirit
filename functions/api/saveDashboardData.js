export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const data = body.args && body.args[0];

    if (!data) {
      return new Response(JSON.stringify(false), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = env.DB;

    // 1. Save Scents
    if (data.scents) {
      await db.prepare("DELETE FROM Scents").run();
      for (const item of data.scents) {
        if (item.name) {
          await db.prepare("INSERT INTO Scents (Name, Taste, Scent) VALUES (?, ?, ?)")
            .bind(item.name, item.taste || "", item.scent || "").run();
        }
      }
    }

    // 2. Save Sweetness
    if (data.sweetness) {
      await db.prepare("DELETE FROM Sweetness").run();
      for (const item of data.sweetness) {
        if (item.name) {
          await db.prepare("INSERT INTO Sweetness (Name, Taste, Scent) VALUES (?, ?, ?)")
            .bind(item.name, item.taste || "", item.scent || "").run();
        }
      }
    }

    // 3. Save Fruit Guidelines
    if (data.fruitFermentation) {
      await db.prepare("DELETE FROM FruitFermentation").run();
      for (const val of data.fruitFermentation) {
        if (val) {
          await db.prepare("INSERT INTO FruitFermentation (Guideline) VALUES (?)")
            .bind(val.toString()).run();
        }
      }
    }

    // 4. Save Grain Guidelines
    if (data.roastedGrainFermentation) {
      await db.prepare("DELETE FROM RoastedGrainFermentation").run();
      for (const val of data.roastedGrainFermentation) {
        if (val) {
          await db.prepare("INSERT INTO RoastedGrainFermentation (Guideline) VALUES (?)")
            .bind(val.toString()).run();
        }
      }
    }

    return new Response(JSON.stringify(true), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
