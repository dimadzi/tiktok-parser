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
    // Якщо цей акаунт вже мав помилку на старті
    if (run.error) {
      results.push({ username: run.username, error: run.error });
      continue;
    }

    try {
      // Перевіряємо статус запуску
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

      // Отримуємо дані
      const itemsRes = await fetch(`${BASE}/datasets/${run.datasetId}/items?token=${apiKey}&limit=200`);
      const items = await itemsRes.json();

      // Фільтр по місяцю
      const monthVideos = (Array.isArray(items) ? items : []).filter((item) => {
        const created = item.createTime || item.createTimeISO || "";
        try {
          const dt = typeof created === "number" ? new Date(created * 1000) : new Date(created);
          return dt.getFullYear() === Number(year) && dt.getMonth() + 1 === Number(month);
        } catch { return false; }
      });

      const totalViews = monthVideos.reduce((sum, v) => sum + (v.playCount || v.stats?.playCount || 0), 0);
      const topVideo = monthVideos.length
        ? monthVideos.reduce((best, v) => {
            const views = v.playCount || v.stats?.playCount || 0;
            const bestViews = best.playCount || best.stats?.playCount || 0;
            return views > bestViews ? v : best;
          })
        : null;

      results.push({
        username: run.username,
        status: "done",
        month: `${year}-${String(month).padStart(2, "0")}`,
        videoCount: monthVideos.length,
        totalViews,
        topVideoUrl: topVideo ? (topVideo.webVideoUrl || topVideo.url || `https://www.tiktok.com/@${run.username}`) : null,
        topVideoViews: topVideo ? (topVideo.playCount || topVideo.stats?.playCount || 0) : 0,
        topVideoDesc: topVideo?.text || topVideo?.desc || "",
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
