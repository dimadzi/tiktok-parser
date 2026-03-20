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

  // Приймає ОДИН акаунт за раз — браузер сам по черзі запускає
  const { apiKey, username, year, month } = body;
  if (!apiKey || !username || !year || !month) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Відсутні обов'язкові поля" }) };
  }

  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        username,
        runId: runData.data.id,
        datasetId: runData.data.defaultDatasetId,
        status: "started",
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ username, error: err.message }),
    };
  }
};
