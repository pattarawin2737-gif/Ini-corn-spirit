export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const stepsList = body.args && body.args[0];

    if (!stepsList) {
      return new Response(JSON.stringify(false), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = env.DB;
    await db.prepare("DELETE FROM ChecklistTemplate").run();

    for (let i = 0; i < stepsList.length; i++) {
      const step = stepsList[i];
      const text = (typeof step === 'object') ? step.text : step.toString();
      const color = (typeof step === 'object' && step.color) ? step.color : "blue";
      
      await db.prepare("INSERT INTO ChecklistTemplate (StepIndex, Text, Color) VALUES (?, ?, ?)")
        .bind(i, text, color).run();
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
