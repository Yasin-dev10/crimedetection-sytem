const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const BlacklistItem = require("../model/BlacklistItem");
const History = require("../model/History");
const { createDailyBlacklistAlert } = require("../services/blacklistAlertService");
const { dispatchCrimeDetection } = require("../services/crimeDetectionService");
const { AI_MODEL_URL } = require("../config/aiModel");

const AI_MODEL_TIMEOUT_MS = Number(process.env.AI_MODEL_TIMEOUT_MS || 30000);
const CRIME_PREDICTIONS = new Set([
  "crime",
  "crime-related",
  "crime related",
  "criminal",
  "1",
  "yes",
  "true",
]);

const normalize = (value = "") => value.toString().toLowerCase();
const trimEvidence = (value = "") => String(value || "").slice(0, 12000);

const removeTempFile = (filePath) => {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.warn("Failed to remove temp upload:", error.message);
  }
};

const normalizeAiResult = (data = {}) => {
  const rawPrediction = data.rawPrediction || data.prediction || "";
  const normalizedPrediction = normalize(rawPrediction).trim();
  const explicitDecision =
    typeof data.isCrime === "boolean"
      ? data.isCrime
      : typeof data.is_crime === "boolean"
        ? data.is_crime
        : null;
  const isCrime =
    explicitDecision !== null
      ? explicitDecision
      : CRIME_PREDICTIONS.has(normalizedPrediction);

  return {
    ...data,
    prediction: isCrime ? "crime-related" : "not crime-related",
    rawPrediction,
    confidence: Number(data.confidence || 0),
    isCrime,
    is_crime: isCrime,
    matchedKeyword: data.matchedKeyword || data.matched_keyword || null,
    location: Array.isArray(data.location)
      ? data.location
      : Array.isArray(data.locations)
        ? data.locations
        : [],
    decision: isCrime ? "CRIME" : "NOT_CRIME",
  };
};

const predictText = async (text) => {
  const response = await axios.post(
    AI_MODEL_URL,
    { text },
    { timeout: AI_MODEL_TIMEOUT_MS }
  );

  return normalizeAiResult(response.data);
};

const resultWithSavedDecision = (result, saved, extra = {}) => {
  const isCrime = Boolean(result.isCrime || saved.blacklistMatches.length > 0);

  return {
    ...result,
    ...extra,
    prediction: isCrime ? "crime-related" : "not crime-related",
    isCrime,
    is_crime: isCrime,
    decision: isCrime ? "CRIME" : "NOT_CRIME",
    blacklistMatches: saved.blacklistMatches,
    priority: saved.priority,
  };
};

const findBlacklistMatches = async ({ content, extractedText = "" }) => {
  const items = await BlacklistItem.find({ active: true });
  const contentText = normalize(`${content} ${extractedText}`);

  return items.filter((item) => {
    const value = normalize(item.value);
    const name = normalize(item.name);

    if (item.type === "keyword") {
      return contentText.includes(value) || contentText.includes(name);
    }

    if (item.type === "website" || item.type === "facebook_page") {
      return normalize(content).includes(value) || contentText.includes(value);
    }

    if (item.type === "person") {
      return contentText.includes(value) || contentText.includes(name);
    }

    return false;
  });
};

const saveHistory = async ({ type, content, result, extractedText = "", userId = null }) => {
  const blacklistMatches = await findBlacklistMatches({
    content,
    extractedText,
  });

  const hasHighPriorityMatch = blacklistMatches.some(
    (item) => item.priority === "high"
  );

  const priority = hasHighPriorityMatch
    ? "high"
    : blacklistMatches[0]?.priority || "normal";

  const history = await History.create({
    type,
    sourceType: type,
    content,
    prediction: result.prediction,
    confidence: result.confidence,
    isCrime: result.isCrime || blacklistMatches.length > 0 || false,
    matchedKeyword:
      result.matchedKeyword ||
      blacklistMatches.find((item) => item.type === "keyword")?.value ||
      null,
    location: Array.isArray(result.location) ? result.location : [],
    extractedText: trimEvidence(extractedText),
    blacklistMatches: blacklistMatches.map((item) => ({
      item: item._id,
      type: item.type,
      value: item.value,
      priority: item.priority,
    })),
    priority,
    user: userId || null,
  });

  if (blacklistMatches.length > 0) {
    await Promise.all(
      blacklistMatches.map((item) =>
        createDailyBlacklistAlert({
          blacklistItem: item._id,
          history: history._id,
          sourceType: type,
          content,
          matchedValue: item.value,
          priority: item.priority,
          dedupeContent: `${type}:${content}:${extractedText}`,
        })
      )
    );
  }

  // AI crime → notify admins + broadcast case to all investigators (first open wins)
  if (history.isCrime) {
    try {
      await dispatchCrimeDetection({ history });
    } catch (error) {
      console.error("CRIME DETECTION DISPATCH ERROR:", error.message);
    }
  }

  return { history, blacklistMatches, priority };
};

const analyzeText = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Text is required" });
    }

    const aiResult = await predictText(text);

    const saved = await saveHistory({
      type: "text",
      content: text,
      result: aiResult,
      userId: req.user?._id || null,
    });

    res.status(200).json({
      message: "Text analysis completed",
      input: text,
      postText: text,
      historyId: saved.history._id,
      result: resultWithSavedDecision(aiResult, saved, { postText: text }),
    });
  } catch (error) {
    console.error("TEXT ANALYSIS ERROR:", error.response?.data || error.message);

    res.status(500).json({
      message: "Text analysis failed",
      error: error.response?.data || error.message,
    });
  }
};

const analyzeUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || url.trim() === "") {
      return res.status(400).json({ message: "URL is required" });
    }

    const page = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(page.data);
    $("script, style, nav, footer").remove();

    const extractedText = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    if (!extractedText) {
      return res.status(400).json({
        message: "No readable text found from URL",
      });
    }

    const aiResult = await predictText(extractedText);

    const saved = await saveHistory({
      type: "url",
      content: url,
      result: aiResult,
      extractedText,
      userId: req.user?._id || null,
    });

    res.status(200).json({
      message: "URL analysis completed",
      url,
      extractedLength: extractedText.length,
      postText: trimEvidence(extractedText),
      historyId: saved.history._id,
      result: resultWithSavedDecision(aiResult, saved, {
        postText: trimEvidence(extractedText),
      }),
    });
  } catch (error) {
    console.error("URL ANALYSIS ERROR:", error.response?.data || error.message);

    res.status(500).json({
      message: "URL analysis failed",
      error: error.response?.data || error.message,
    });
  }
};

const analyzeFile = async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    let extractedText = "";
    filePath = req.file.path;
    const fileName = req.file.originalname.toLowerCase();

    if (fileName.endsWith(".pdf")) {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    } else if (fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
    } else if (fileName.endsWith(".txt")) {
      extractedText = fs.readFileSync(filePath, "utf8");
    } else {
      removeTempFile(filePath);
      filePath = null;
      return res.status(400).json({
        message: "Only PDF, DOCX, TXT files are allowed",
      });
    }

    if (!extractedText || extractedText.trim() === "") {
      return res.status(400).json({
        message: "No readable text found in file",
      });
    }

    const aiResult = await predictText(extractedText.slice(0, 8000));

    const saved = await saveHistory({
      type: "file",
      content: req.file.originalname,
      result: aiResult,
      extractedText,
      userId: req.user?._id || null,
    });

    removeTempFile(filePath);
    filePath = null;

    res.status(200).json({
      message: "File analysis completed",
      file: req.file.originalname,
      extractedLength: extractedText.length,
      postText: trimEvidence(extractedText),
      historyId: saved.history._id,
      result: resultWithSavedDecision(aiResult, saved, {
        postText: trimEvidence(extractedText),
      }),
    });
  } catch (error) {
    removeTempFile(filePath);
    console.error("FILE ANALYSIS ERROR:", error.response?.data || error.message);

    res.status(500).json({
      message: "File analysis failed",
      error: error.response?.data || error.message,
    });
  }
};

const analyzeBatch = async (req, res) => {
  try {
    const { type, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Items array is required",
      });
    }

    const results = [];

    for (const item of items) {
      try {
        let textToAnalyze = item;

        if (type === "url") {
          const page = await axios.get(item, {
            timeout: 10000,
            headers: { "User-Agent": "Mozilla/5.0" },
          });

          const $ = cheerio.load(page.data);
          $("script, style, nav, footer").remove();

          textToAnalyze = $("body")
            .text()
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);
        }

        const aiResult = await predictText(textToAnalyze);

        const saved = await saveHistory({
          type: "batch",
          content: item,
          result: aiResult,
          extractedText: textToAnalyze,
          userId: req.user?._id || null,
        });

        results.push({
          input: item,
          success: true,
          historyId: saved.history._id,
          postText: trimEvidence(textToAnalyze),
          result: resultWithSavedDecision(aiResult, saved, {
            postText: trimEvidence(textToAnalyze),
          }),
        });
      } catch (err) {
        results.push({
          input: item,
          success: false,
          error: err.message,
        });
      }
    }

    res.status(200).json({
      message: "Batch analysis completed",
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("BATCH ANALYSIS ERROR:", error.response?.data || error.message);

    res.status(500).json({
      message: "Batch analysis failed",
      error: error.response?.data || error.message,
    });
  }
};

module.exports = {
  analyzeText,
  analyzeUrl,
  analyzeFile,
  analyzeBatch,
};
