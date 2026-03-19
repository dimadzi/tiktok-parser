const { ApifyClient } = require("apify-client");

const ACTOR_ID = "clockworks/tiktok-profile-scraper";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { apiKey, accounts, year, month } = body;

  if (!apiKey || !accounts?.length || !year || !month) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Відсутні обов'язкові поля" }) };
  }

  const client = new ApifyClient({ token: apiKey });
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;

  const results = [];

  for (const username of accounts) {
    try {
      const run = await client.actor(ACTOR_ID).call({
        profiles: [username],
        profileSections: ["videos"],
        profileVideosSortedBy: "latest",
        maxPostsPerProfile: 100,
        publishedAfterDate: dateFrom,
      }, { timeoutSecs: 300 });

      const items = [];
      for await (const item of client.dataset(run.defaultDatasetId).iterate()) {
        items.push(item);
      }

      // Фільтр по місяцю
      const monthVideos = items.filter((item) => {
        const created = item.createTime || item.createTimeISO || "";
        try {
          let dt;
          if (typeof created === "number") {
            dt = new Date(created * 1000);
          } else {
            dt = new Date(created);
          }
          return dt.getFullYear() === Number(year) && dt.getMonth() + 1 === Number(month);
        } catch {
          return false;
        }
      });

      const totalViews = monthVideos.reduce((sum, v) => {
        return sum + (v.playCount || v.stats?.playCount || 0);
      }, 0);

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
        topVideoUrl: topVideo
          ? topVideo.webVideoUrl || topVideo.url || `https://www.tiktok.com/@${username}`
          : null,
        topVideoViews: topVideo
          ? topVideo.playCount || topVideo.stats?.playCount || 0
          : 0,
        topVideoDesc: topVideo?.text || topVideo?.desc || "",
      });
    } catch (err) {
      results.push({ username, error: err.message || "Помилка парсингу" });
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ results }) };
};
