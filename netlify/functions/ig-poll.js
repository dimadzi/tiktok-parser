const BASE = "https://api.apify.com/v2";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { apiKey, runs, year, month } = body;
  if (!apiKey || !runs?.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Відсутні обов'язкові поля" }) };
  }

  const results = [];

  for (const run of runs) {
    if (run.error) {
      results.push({ username: run.username, error: run.error });
      continue;
    }

    try {
      const statusRes = await fetch(`${BASE}/actor-runs/${run.runId}?token=${apiKey}`);
      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      if (status === "RUNNING" || status === "READY" || status === "INITIALIZING") {
        results.push({ username: run.username, status: "pending", runId: run.runId, datasetId: run.datasetId });
        continue;
      }

      if (status !== "SUCCEEDED") {
        results.push({ username: run.username, error: `Статус: ${status}` });
        continue;
      }

      const itemsRes = await fetch(`${BASE}/datasets/${run.datasetId}/items?token=${apiKey}&limit=300`);
      const items = await itemsRes.json();

      // Фільтр по місяцю — поле timestamp: "2026-03-30T20:15:44.000Z"
      const monthReels = (Array.isArray(items) ? items : []).filter((item) => {
        const ts = item.timestamp || item.takenAt || "";
        try {
          const dt = new Date(ts);
          return dt.getFullYear() === Number(year) && dt.getMonth() + 1 === Number(month);
        } catch { return false; }
      });

      const totalViews = monthReels.reduce((sum, v) => sum + (v.videoPlayCount || 0), 0);

      const topReel = monthReels.length
        ? monthReels.reduce((best, v) =>
            (v.videoPlayCount || 0) > (best.videoPlayCount || 0) ? v : best
          )
        : null;

      results.push({
        username: run.username,
        status: "done",
        month: `${year}-${String(month).padStart(2, "0")}`,
        reelCount: monthReels.length,
        totalViews,
        topReelUrl: topReel?.url || null,
        topReelViews: topReel?.videoPlayCount || 0,
        topReelLikes: topReel?.likesCount || 0,
      });

    } catch (err) {
      results.push({ username: run.username, error: err.message });
    }
  }

  const allDone = results.every(r => r.status === "done" || r.error);
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ results, allDone }),
  };
};
