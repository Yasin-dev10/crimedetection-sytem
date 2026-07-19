const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const Prediction = require('../models/Prediction');
const CrimeReport = require('../models/CrimeReport');
const Log = require('../models/Log');
const { DASHBOARD_ROLES, ROLES } = require('../config/roles');
const { authenticate, authorize } = require('../middleware/auth');
const { dbHealth } = require('../config/database');
const EmergencyAlerts = require('../services/emergencyAlerts');
const Notifications = require('../services/notifications');

const PYTHON_API = process.env.PYTHON_API_URL || 'http://localhost:5000';
const PYTHON_API_TIMEOUT_MS = Number(process.env.PYTHON_API_TIMEOUT_MS || 120000);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 100);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const pythonApi = axios.create({
  baseURL: PYTHON_API,
  timeout: PYTHON_API_TIMEOUT_MS
});

const getErrorDetails = (err) => (
  err.response?.data?.details ||
  err.response?.data?.error ||
  err.message
);

const csvValue = (value) => (
  `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
);

const reportsToCsv = (reports) => {
  const headers = [
    'id',
    'prediction_id',
    'status',
    'prediction',
    'final_is_crime',
    'assigned_to',
    'confidence',
    'user_name',
    'user_role',
    'input_text',
    'created_at'
  ];
  const rows = reports.map((report) => [
    report._id,
    report.predictionId,
    report.status,
    report.prediction,
    report.finalIsCrime,
    report.assignedTo?.name,
    report.confidence,
    report.user?.name,
    report.user?.role,
    report.inputText,
    report.createdAt ? new Date(report.createdAt).toISOString() : ''
  ].map(csvValue).join(','));

  return [headers.join(','), ...rows].join('\n');
};

const normalizeCaseStatus = (status) => {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  if (normalized === 'closed') return 'resolved';
  if (['new', 'reviewing', 'resolved'].includes(normalized)) return normalized;
  return null;
};

const normalizeFinalDecision = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['crime', 'crime-related', 'true', 'yes'].includes(normalized)) return true;
  if (['not_crime', 'not-crime', 'not crime', 'not crime-related', 'false', 'no'].includes(normalized)) return false;
  return null;
};

router.use(authenticate);

const userSnapshot = (user) => ({
  id: user._id,
  name: user.name,
  role: user.role
});

const withPredictionMeta = (result, prediction) => {
  const response = {
    ...result,
    id: prediction._id,
    prediction: prediction.prediction || result.prediction,
    is_crime: Boolean(prediction.isCrime ?? result.is_crime),
    confidence: Number(prediction.confidence ?? result.confidence ?? 0),
    crime_probability: prediction.crimeProbability ?? result.crime_probability ?? null,
    crime_threshold: prediction.crimeThreshold ?? result.crime_threshold ?? null,
    inputText: prediction.inputText,
    emergencyAlert: prediction.emergencyAlert
  };

  return response;
};

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/plain', 'text/csv', 'application/json', 'text/html'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|csv|json|html|md)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only text files are allowed (txt, csv, json, html, md)'));
    }
  }
});
const uploadSingleFile = upload.single('file');

// POST /api/analyze/text - Classify a single text
router.post('/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const response = await pythonApi.post('/api/classify/text', { text });
    const result = response.data;

    // Save to predictions collection
    const prediction = await Prediction.save({
      type: 'text',
      user: userSnapshot(req.user),
      inputText: text,
      modelLoaded: result.model_loaded,
      input: { text: text.substring(0, 500) },
      result: {
        prediction: result.prediction,
        is_crime: result.is_crime,
        confidence: result.confidence,
        crime_probability: result.crime_probability,
        crime_threshold: result.crime_threshold,
        processed_text: result.processed_text
      }
    });

    res.json(withPredictionMeta(result, prediction));
  } catch (err) {
    console.error('Text classification error:', err.message);
    res.status(500).json({ error: 'Classification failed', details: getErrorDetails(err) });
  }
});

// POST /api/analyze/url - Scrape and classify URL
router.post('/url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const response = await pythonApi.post('/api/classify/url', { url });
    const result = response.data;

    // Save to predictions collection
    const prediction = await Prediction.save({
      type: 'url',
      user: userSnapshot(req.user),
      inputText: `${result.scraped_title || ''} ${result.scraped_content || ''}`.trim(),
      modelLoaded: result.model_loaded,
      input: { url },
      result: {
        prediction: result.prediction,
        is_crime: result.is_crime,
        confidence: result.confidence,
        crime_probability: result.crime_probability,
        crime_threshold: result.crime_threshold,
        processed_text: result.processed_text
      },
      scraped_data: {
        title: result.scraped_title,
        content: result.scraped_content
      }
    });

    res.json(withPredictionMeta(result, prediction));
  } catch (err) {
    console.error('URL classification error:', err.message);
    res.status(500).json({ error: 'URL analysis failed', details: getErrorDetails(err) });
  }
});

// POST /api/analyze/file - Upload and classify file
router.post('/file', (req, res, next) => {
  uploadSingleFile(req, res, (err) => {
    if (err) {
      const details = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${MAX_UPLOAD_MB}MB`
        : err.message;
      return res.status(400).json({ error: 'File upload failed', details });
    }

    return next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Forward file to Python API
    const fileFormData = new FormData();
    fileFormData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype || 'text/plain'
    });

    const response = await pythonApi.post('/api/classify/file', fileFormData, {
      headers: fileFormData.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    const result = response.data;

    const fileText = req.file.buffer.toString('utf8');

    // Save to predictions collection
    const prediction = await Prediction.save({
      type: 'file',
      user: userSnapshot(req.user),
      inputText: fileText,
      modelLoaded: result.overall?.model_loaded,
      input: {
        filename: req.file.originalname,
        batch_count: result.segments?.length || 1
      },
      result: {
        prediction: result.overall?.prediction,
        is_crime: result.overall?.is_crime,
        confidence: result.overall?.confidence,
        crime_probability: result.overall?.crime_probability,
        crime_threshold: result.overall?.crime_threshold,
        processed_text: result.overall?.processed_text
      },
      segments: result.segments || [],
      summary: result.summary
    });

    res.json(withPredictionMeta(result, prediction));
  } catch (err) {
    console.error('File classification error:', err.message);
    res.status(500).json({ error: 'File analysis failed', details: getErrorDetails(err) });
  }
});

// POST /api/analyze/batch - Classify multiple texts
router.post('/batch', async (req, res) => {
  try {
    const { texts } = req.body;
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'Texts array is required' });
    }

    const response = await pythonApi.post('/api/classify/batch', { texts });
    const result = response.data;

    // Save to predictions collection
    const prediction = await Prediction.save({
      type: 'batch',
      user: userSnapshot(req.user),
      inputText: texts.join('\n'),
      modelLoaded: result.results?.some((item) => item.model_loaded),
      input: { batch_count: texts.length },
      segments: result.results || [],
      summary: result.summary
    });

    res.json(withPredictionMeta(result, prediction));
  } catch (err) {
    console.error('Batch classification error:', err.message);
    res.status(500).json({ error: 'Batch analysis failed', details: getErrorDetails(err) });
  }
});

// GET /api/analyze/model/info - Get Python model information
router.get('/model/info', authorize(...DASHBOARD_ROLES), async (req, res) => {
  try {
    const response = await pythonApi.get('/api/model/info');
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch model info', details: getErrorDetails(err) });
  }
});

// GET /api/analyze/history - Get prediction history
router.get('/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { predictions, total } = await Prediction.list({ page, limit, user: req.user });

    res.json({
      predictions,
      analyses: predictions,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history', details: err.message });
  }
});

// GET /api/analyze/stats - Get statistics
router.get('/stats', authorize(...DASHBOARD_ROLES), async (req, res) => {
  try {
    const [stats, recent, crimeReportStats] = await Promise.all([
      Prediction.stats(),
      Prediction.recent(7),
      CrimeReport.stats()
    ]);

    res.json({
      ...stats,
      recent,
      crime_reports: crimeReportStats,
      system: {
        backend: {
          status: 'online',
          uptime_seconds: Math.round(process.uptime()),
          node_env: process.env.NODE_ENV || 'development'
        },
        database: dbHealth(),
        notifications: Notifications.getNotificationStatus(),
        emergency_alerts: EmergencyAlerts.getEmergencyAlertStatus(),
        generated_at: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// GET /api/analyze/crime-reports/export - Export all crime reports for dashboard users
router.get('/crime-reports/export', authorize(...DASHBOARD_ROLES), async (req, res) => {
  try {
    const format = String(req.query.format || 'csv').trim().toLowerCase();
    const reports = await CrimeReport.all();
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="crime-reports-${timestamp}.json"`);
      return res.json({ exportedAt: new Date().toISOString(), reports });
    }

    const csv = reportsToCsv(reports);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="crime-reports-${timestamp}.csv"`);
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export crime reports', details: err.message });
  }
});

// GET /api/analyze/crime-reports - Get reports auto-created from crime predictions
router.get('/crime-reports', authorize(...DASHBOARD_ROLES), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { reports, total } = await CrimeReport.list({ page, limit });
    res.json({
      reports,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch crime reports', details: err.message });
  }
});

// POST /api/analyze/crime-reports - Send any prediction to an investigator
router.post('/crime-reports', authorize(...DASHBOARD_ROLES), async (req, res) => {
  try {
    const { predictionId, investigatorNotes, finalDecision, note } = req.body;
    if (!predictionId) {
      return res.status(400).json({ error: 'predictionId is required' });
    }

    const prediction = await Prediction.findById(predictionId, req.user);
    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    const normalizedDecision = normalizeFinalDecision(finalDecision);

    const createOptions = {
      force: true,
      status: 'reviewing',
      assignedTo: userSnapshot(req.user),
      investigatorNotes: note || investigatorNotes || ''
    };

    // Apply initial classification if provided by user
    if (normalizedDecision !== null) {
      createOptions.finalIsCrime = normalizedDecision;
      createOptions.prediction = normalizedDecision ? 'crime-related' : 'not crime-related';
    }

    const report = await CrimeReport.createFromPrediction(prediction, createOptions);

    // If a final decision was provided, also update the original prediction
    if (normalizedDecision !== null && report.predictionId) {
      await Prediction.updateDecisionById(
        report.predictionId,
        normalizedDecision,
        { prediction: createOptions.prediction }
      ).catch(() => null); // non-fatal
    }

    await Log.write({
      action: 'crime_report.assigned',
      message: `Prediction sent to investigator review${normalizedDecision !== null ? ` (classified as ${normalizedDecision ? 'crime' : 'not crime'})` : ''}`,
      user: userSnapshot(req.user),
      meta: {
        reportId: report._id,
        predictionId,
        finalDecision: normalizedDecision,
        originalIsCrime: report.originalIsCrime
      }
    });

    res.status(201).json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create investigation case', details: err.message });
  }
});

// PATCH /api/analyze/crime-reports/:id - Update crime report status (investigator only)
router.patch('/crime-reports/:id', authorize(...DASHBOARD_ROLES), async (req, res) => {
  try {
    const { status, investigatorNotes, finalDecision, assignToMe } = req.body;
    const updates = {};
    const normalizedStatus = normalizeCaseStatus(status);
    const normalizedDecision = normalizeFinalDecision(finalDecision);
    if (status && !normalizedStatus) {
      return res.status(400).json({ error: 'Invalid case status' });
    }
    if (normalizedStatus) updates.status = normalizedStatus;
    if (investigatorNotes !== undefined) updates.investigatorNotes = investigatorNotes;
    if (assignToMe || normalizedStatus === 'reviewing') updates.assignedTo = userSnapshot(req.user);
    if (normalizedDecision !== null) {
      updates.finalIsCrime = normalizedDecision;
      updates.prediction = normalizedDecision ? 'crime-related' : 'not crime-related';
      if (!normalizedDecision) updates.emergencyAlert = null;
    }
    if (normalizedStatus === 'resolved') {
      updates.resolvedAt = new Date().toISOString();
      updates.resolvedBy = userSnapshot(req.user);
    }

    const updated = await CrimeReport.updateById(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Crime report not found' });
    }

    let correctedPrediction = null;
    if (normalizedDecision !== null && updated.predictionId) {
      correctedPrediction = await Prediction.updateDecisionById(
        updated.predictionId,
        normalizedDecision,
        { prediction: updates.prediction }
      );
    }

    await Log.write({
      action: 'crime_report.updated',
      message: `Investigator updated crime report to: ${updated.status}`,
      user: userSnapshot(req.user),
      meta: {
        reportId: updated._id,
        status: updated.status,
        finalIsCrime: updated.finalIsCrime,
        hasNotes: investigatorNotes !== undefined
      }
    });

    res.json({ report: updated, prediction: correctedPrediction });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update crime report', details: err.message });
  }
});

// DELETE /api/analyze/crime-reports/:id - Delete a crime report (admin only)
router.delete('/crime-reports/:id', authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const deleted = await CrimeReport.deleteById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Crime report not found' });
    }

    await Log.write({
      level: 'warn',
      action: 'crime_report.deleted',
      message: 'Admin deleted a crime report',
      user: userSnapshot(req.user),
      meta: {
        reportId: deleted._id,
        predictionId: deleted.predictionId,
        confidence: deleted.confidence
      }
    });

    res.json({ report: deleted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete crime report', details: err.message });
  }
});

// GET /api/analyze/logs - Get system logs (admin only)
router.get('/logs', authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { logs, total } = await Log.list({ page, limit });
    res.json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs', details: err.message });
  }
});

// GET /api/analyze/:id - Get single prediction
router.get('/:id', async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id, req.user);
    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prediction', details: err.message });
  }
});

module.exports = router;
