const ACTOR_ID = "clockworks~tiktok-profile-scraper";
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

  const { apiKey, accounts, year, month } = body;
  if (!apiKey || !accounts?.length || !year || !month) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Відсутні обов'язкові поля" }) };
  }

  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const runs = [];

  // Запускаємо актор для кожного акаунту — НЕ чекаємо результату
  for (const username of accounts) {
    try {
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

      runs.push({
        username,
        runId: runData.data.id,
        datasetId: runData.data.defaultDatasetId,
      });
    } catch (err) {
      runs.push({ username, error: err.message });
    }
  }

  // Повертаємо runId одразу — браузер буде поллити статус сам
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ runs, year, month }),
  };
};
