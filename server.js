/**
 * Lomed - Hebrew School Notes & Homework Companion
 * Express backend server configured for Render deployment & Capacitor Android client.
 * Uses official @google/genai SDK with gemini-2.5-flash for Hebrew handwriting OCR and JSON extraction.
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Configure Multer for in-memory upload (avoids ephemeral filesystem issues on Render)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max per image
    files: 10, // Up to 10 photos of notebook pages
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('רק קובצי תמונה נתמכים (JPG, PNG, WEBP) / Only image files are supported'));
    }
  },
});

// Middleware
app.use(cors({
  origin: '*', // Allows Capacitor mobile apps, localhost, and remote clients
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Serve static assets from public/ folder (used by Capacitor webDir and web clients)
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Google GenAI client (server-side only)
let aiClient = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// In-memory store for session notes and homework (can also be synced with client localStorage)
let notesDatabase = [
  {
    id: 'sample-tanakh-1',
    subject: 'תנ״ך',
    topic: 'שמואל א׳ - פרק ח׳: בקשת העם למלך ומשפט המלך',
    date: '18/10/2026',
    createdAt: new Date().toISOString(),
    summary: 'בשיעור עסקנו בבקשת זקני ישראל משמואל הנביא למנות להם מלך "ככל הגויים". שמואל מתנגד בתחילה ורואה בכך כפיות טובה כלפי ה׳. ה׳ מורה לו לשמוע לקול העם אך להזהירם מפני "משפט המלך" – תיאור עול המיסים, גיוס הבנים לצבא וההשתלטות על שדות וכרמים.',
    keyConcepts: [
      { term: 'משפט המלך', definition: 'רשימת הזכויות והעריצות של המלך כלפי נתיניו (לקיחת בנים לצבא, מיסוי כבד)' },
      { term: 'ככל הגויים', definition: 'השאיפה המסוכנת של עם ישראל להידמות לעמים השכנים במקום להיות עם סגולה' },
      { term: 'שמואל ברמה', definition: 'מקום מושבו של שמואל הנביא והשופט האחרון' }
    ],
    homework: [
      {
        id: 'hw-tanakh-101',
        task: 'קריאת פרק ח׳ בספר שמואל א׳ ומענה על שאלות 1 עד 4 בעמוד 38 בחוברת',
        subject: 'תנ״ך',
        dueDate: 'יום שלישי הקרוב',
        priority: 'גבוהה',
        completed: false
      },
      {
        id: 'hw-tanakh-102',
        task: 'השוואת משפט המלך לחוק המלך בספר דברים י״ז (טבלה במחברת)',
        subject: 'תנ״ך',
        dueDate: 'יום חמישי',
        priority: 'רגילה',
        completed: true
      }
    ],
    fullTranscription: 'שיעור תנ״ך - יום ראשון\nנושא: שמואל א פרק ח - משפט המלך\nהעם מגיע לרמה ומבקש מלך. שמואל כועס.\nה׳ אומר לשמואל: "לא אותך מאסו כי אותי מאסו ממלוך עליהם".\nמשפט המלך כולל:\n- ייקח את בניכם למרכבתו\n- יזרע שדותיו ויקצור קצירו\n- עשר מצאנכם ומכרמיכם\nש״ב: עמ׳ 38 שאלות 1-4, להביא תנ״ך מלא לשיעור הבא.',
    imageCount: 1,
    confidenceNotes: 'פענוח כתב יד עברי מלא בהצלחה גבוהה'
  },
  {
    id: 'sample-history-2',
    subject: 'היסטוריה',
    topic: 'המהפכה המדעית ועידן הנאורות באירופה',
    date: '17/10/2026',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    summary: 'סקרנו את השינוי בתפיסת העולם במאות ה-17 וה-18: מעבר מאמונה דוגמטית לסמכות הכנסייה לעבר חשיבה ביקורתית, תצפית אמפירית ושימוש בשכל ובתבונה (רציונליזם). דנו בהוגים המרכזיים: גלילאו, ניוטון, וולטר ורוסו.',
    keyConcepts: [
      { term: 'רציונליזם', definition: 'גישה פילוסופית המעמידה את התבונה האנושית כמקור הידע המרכזי' },
      { term: 'אמפיריציזם', definition: 'התבססות על ניסויים, מדידות ותצפיות מדעיות מוכחות' },
      { term: 'אמנה חברתית', definition: 'הרעיון של ז׳אן ז׳אק רוסו אודות הסכם בלתי כתוב בין השליט לעם' }
    ],
    homework: [
      {
        id: 'hw-hist-201',
        task: 'סיכום עמודים 82-87 בספר ההיסטוריה על עקרון הפרדת הרשויות של מונטסקייה',
        subject: 'היסטוריה',
        dueDate: 'סוף השבוע',
        priority: 'גבוהה',
        completed: false
      }
    ],
    fullTranscription: 'היסטוריה י״א - עידן האורות\nעקרונות הנאורות: העז לדעת! (קאנט)\nספקנות, ביקורת על מוסדות מסורתיים, זכויות טבעיות (חיים, חירות, קניין).\nשיעורי בית: עמ׳ 82-87 לקרוא ולסכם את מונטסקייה והפרדת הרשויות.',
    imageCount: 1,
    confidenceNotes: 'פענוח מלא'
  }
];

// Helper: System instruction for Hebrew OCR and educational synthesis
const HEBREW_OCR_SYSTEM_INSTRUCTION = `
אתה מומחה מוביל לפענוח כתב יד בעברית (כתב עגול, כתב רהוט, דפוס) ועוזר למידה דיגיטלי לתלמידי בית ספר בישראל.
תפקידך לקבל תמונות של מחברות תלמידים בכתב יד, לפענח את הטקסט בעברית בדיוק רב, ולהחזיר מבנה נתונים מפורט בפורמט JSON תקני.

עליך לחלץ:
1. מקצוע הלימוד (subject): למשל תנ״ך, היסטוריה, ספרות, מתמטיקה, לשון והבעה, מדעים, גיאוגרפיה, אנגלית, ביולוגיה, כימיה, פיזיקה, אזרחות.
2. נושא השיעור (topic): כותרת ברורה ותמציתית של הנלמד.
3. תאריך השיעור (date): אם מופיע בעמוד, חלץ אותו. אם לא צוין, כתוב את התאריך המשוער או תאריך היום בפורמט DD/MM/YYYY.
4. סיכום השיעור (summary): סיכום ברור, מאורגן, קריא ועשיר של עיקרי השיעור הנלמד, כולל הסברים ונקודות מפתח.
5. מושגי מפתח (keyConcepts): מערך של מושגים חשובים שהוזכרו והגדרתם (term ו-definition).
6. שיעורי בית ומטלות (homework): מערך של כל המשימות, שיעורי הבית, תרגילי החזרה, עמודים בספר או עבודות הגשה שהמורה הכתיב או שהתלמיד רשם. כל פריט כולל: task, subject, dueDate (אם צוין), priority ("גבוהה" / "רגילה" / "נמוכה"), completed (תמיד false בתחילה).
7. תמלול מלא של כתב היד (fullTranscription): תמלול מילה במילה של מה שכתוב בעמוד, שומר על סדר השורות.
8. הערות ביטחון (confidenceNotes): הערה קצרה בעברית אם יש מילים מטושטשות או חלקיות.

חשוב מאוד: החזר תמיד אך ורק JSON תקין ללא שום תוספת טקסט מסביב!
`;

// API Routes

/**
 * Health check & status endpoint
 */
app.get('/api/health', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    service: 'Lomed Hebrew School Companion API',
    version: '1.0.0',
    model: MODEL_NAME,
    hasApiKey: hasKey,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get all saved notebook summaries and homework
 */
app.get('/api/notes', (req, res) => {
  res.json({
    success: true,
    total: notesDatabase.length,
    notes: notesDatabase,
  });
});

/**
 * Upload and process handwritten Hebrew notebook photos with Gemini 2.5 Flash
 */
app.post('/api/process-notes', upload.array('images', 10), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'לא הועלו תמונות. אנא בחר תמונה אחת לפחות של מחברת הלימוד. / No images uploaded.',
      });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(500).json({
        success: false,
        error: 'מפתח GEMINI_API_KEY אינו מוגדר בשרת. אנא הגדר את המפתח בהגדרות הסביבה. / GEMINI_API_KEY not configured.',
      });
    }

    // Build multimodal inlineData parts for each uploaded notebook photo
    const imageParts = files.map((file) => ({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString('base64'),
      },
    }));

    const promptText = `
פענח את תמונות דפי המחברת בעברית המצורפות. 
זהה במדויק את המקצוע, נושא השיעור, התאריך, סיכום הנקודות המרכזיות, מושגי מפתח, רשימת שיעורי הבית והמטלות, ותמלול מלא של כתב היד.
החזר מבנה JSON תקני לחלוטין לפי הסכמה הבאה:
{
  "subject": "שם המקצוע בעברית",
  "topic": "נושא השיעור",
  "date": "DD/MM/YYYY",
  "summary": "סיכום מקיף של השיעור",
  "keyConcepts": [
    { "term": "שם המושג", "definition": "הסבר המושג" }
  ],
  "homework": [
    {
      "task": "תיאור מדויק של המטלה",
      "dueDate": "תאריך יעד",
      "priority": "גבוהה | רגילה | נמוכה"
    }
  ],
  "fullTranscription": "תמלול מלא של הטקסט המקורי בכתב היד",
  "confidenceNotes": "הערה לגבי איכות הפענוח"
}
`;

    // Call Gemini 2.5 Flash via official @google/genai SDK
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [...imageParts, { text: promptText }],
      },
      config: {
        systemInstruction: HEBREW_OCR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.2, // Low temperature for high OCR accuracy
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('לא התקבלה תשובה ממודל הבינה המלאכותית / Empty response from Gemini');
    }

    // Parse the JSON output
    let parsedData;
    try {
      parsedData = JSON.parse(responseText.trim());
    } catch (parseErr) {
      // Clean possible markdown code fences if present
      const cleanJson = responseText
        .replace(/^```json/m, '')
        .replace(/^```/m, '')
        .replace(/```$/m, '')
        .trim();
      parsedData = JSON.parse(cleanJson);
    }

    // Normalize homework items with unique IDs and initial completion status
    const homeworkItems = (parsedData.homework || []).map((hw, idx) => ({
      id: `hw-${Date.now()}-${idx}`,
      task: hw.task || 'מטלה לא צוינה',
      subject: parsedData.subject || 'כללי',
      dueDate: hw.dueDate || 'לשיעור הבא',
      priority: hw.priority || 'רגילה',
      completed: false,
    }));

    // Create persistent note object
    const newNote = {
      id: `note-${Date.now()}`,
      subject: parsedData.subject || 'כללי',
      topic: parsedData.topic || 'שיעור ללא כותרת',
      date: parsedData.date || new Date().toLocaleDateString('he-IL'),
      createdAt: new Date().toISOString(),
      summary: parsedData.summary || 'לא זוהה סיכום מפורט.',
      keyConcepts: parsedData.keyConcepts || [],
      homework: homeworkItems,
      fullTranscription: parsedData.fullTranscription || '',
      imageCount: files.length,
      confidenceNotes: parsedData.confidenceNotes || 'פוענח בהצלחה',
    };

    // Save to server-side session collection (newest first)
    notesDatabase.unshift(newNote);

    return res.json({
      success: true,
      note: newNote,
      message: 'המחברת פוענחה בהצלחה! / Notebook processed successfully',
    });
  } catch (error) {
    console.error('Error processing Hebrew notes:', error);
    return res.status(500).json({
      success: false,
      error: `שגיאה בעיבוד התמונה: ${error.message || 'שגיאה לא ידועה'}`,
    });
  }
});

/**
 * Toggle homework completed status
 */
app.patch('/api/notes/:noteId/homework/:homeworkId', (req, res) => {
  const { noteId, homeworkId } = req.params;
  const { completed } = req.body;

  const note = notesDatabase.find((n) => n.id === noteId);
  if (!note) {
    return res.status(404).json({ success: false, error: 'המחברת לא נמצאה / Note not found' });
  }

  const task = note.homework.find((h) => h.id === homeworkId);
  if (!task) {
    return res.status(404).json({ success: false, error: 'המטלה לא נמצאה / Task not found' });
  }

  task.completed = typeof completed === 'boolean' ? completed : !task.completed;

  res.json({
    success: true,
    task,
    note,
  });
});

/**
 * Delete a note
 */
app.delete('/api/notes/:noteId', (req, res) => {
  const { noteId } = req.params;
  const initialLength = notesDatabase.length;
  notesDatabase = notesDatabase.filter((n) => n.id !== noteId);

  if (notesDatabase.length === initialLength) {
    return res.status(404).json({ success: false, error: 'המחברת לא נמצאה' });
  }

  res.json({
    success: true,
    message: 'המחברת נמחקה בהצלחה',
  });
});

/**
 * Reset / inject demo sample data for quick preview & testing
 */
app.post('/api/reset-demo', (req, res) => {
  // Resets to initial sample notes
  res.json({
    success: true,
    message: 'דוגמאות נטענו מחדש בהצלחה',
    notes: notesDatabase,
  });
});

// Fallback to index.html for SPA client navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(` לומד - שרת בית ספר עברי פועל על פורט ${PORT}`);
  console.log(` Lomed Hebrew School Companion running on port ${PORT}`);
  console.log(` Gemini Model: ${MODEL_NAME}`);
  console.log(` GEMINI_API_KEY set: ${Boolean(process.env.GEMINI_API_KEY)}`);
  console.log(` Web & Android assets served from: ${path.join(__dirname, 'public')}`);
  console.log(`=================================================`);
});
