const ACTOR_ID = "clockworks~tiktok-profile-scraper";

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

  const { apiKey, accounts, year, month } = body;
  if (!apiKey || !accounts?.length || !year || !month) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Відсутні обов'язкові поля" }) };
  }

  const BASE = "https://api.apify.com/v2";
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const results = [];

  for (const username of accounts) {
    try {
      // 1. Запустити актор
      const runRes = await fetch(`${BASE}/acts/${ACTOR_ID}/runs?token=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profiles: [username],
          profileSections: ["videos"],
          profileVideosSortedBy: "latest",
          maxPostsPerProfile: 100,
          publishedAfterDate: dateFrom,
        }),
      });

      const runData = await runRes.json();
      if (!runRes.ok) throw new Error(runData?.error?.message || `Run failed: ${runRes.status}`);

      const runId = runData.data.id;
      const datasetId = runData.data.defaultDatasetId;

      // 2. Чекати завершення (polling кожні 5 секунд, макс 4 хвилини)
      let status = "RUNNING";
      for (let i = 0; i < 48; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(`${BASE}/actor-runs/${runId}?token=${apiKey}`);
        const statusData = await statusRes.json();
        status = statusData.data?.status;
        if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED") break;
      }

      if (status !== "SUCCEEDED") throw new Error(`Актор завершився зі статусом: ${status}`);

      // 3. Отримати результати
      const itemsRes = await fetch(`${BASE}/datasets/${datasetId}/items?token=${apiKey}&limit=200`);
      const items = await itemsRes.json();

      // 4. Фільтр по місяцю
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
        username,
        month: `${year}-${String(month).padStart(2, "0")}`,
        videoCount: monthVideos.length,
        totalViews,
        topVideoUrl: topVideo ? (topVideo.webVideoUrl || topVideo.url || `https://www.tiktok.com/@${username}`) : null,
        topVideoViews: topVideo ? (topVideo.playCount || topVideo.stats?.playCount || 0) : 0,
        topVideoDesc: topVideo?.text || topVideo?.desc || "",
      });

    } catch (err) {
      results.push({ username, error: err.message || "Помилка парсингу" });
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ results }) };
};
