/******************************************************************************
 *                               Imports + Setup                              *
 ******************************************************************************/
// Firestore (DB) import
const Firestore = require('@google-cloud/firestore');

// Firestore (DB) setup
const PROJECTID = 'double-willow-379721';
const COLLECTION_NAME = 'test-blog';
const firestore = new Firestore({
  projectId: PROJECTID,
  timestampsInSnapshots: true
  // NOTE: Don't hardcode your project credentials here.
  // If you have to, export the following to your shell:
  //   GOOGLE_APPLICATION_CREDENTIALS=<path>
  // keyFilename: '/cred/cloud-functions-firestore-000000000000.json',
});

// Express (REST) import
const express = require('express');
import { Request, Response, NextFunction } from 'express';
// Express (REST) setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS (security?) import
const cors = require('cors');
// CORS (security?) setup
app.use(cors({
  origin: '*'
}));


/******************************************************************************
 *                             Datastore Constants                            *
 ******************************************************************************/
// Firestore states field value length limit for indexed fields as 1,500 bytes
// - UTF-8 chars take up 2 bytes each: therefore 750 character length limit
// If you want to increase this limit, verify that we are using NON-INDEXED...
// ...field values 
// See: https://firebase.google.com/docs/firestore/quotas#limits
const GCLOUD_STRING_LENGTH_LIMIT = 750;
// DB_STR_LIMIT slightly shorter for safety
const DB_STR_LIMIT = GCLOUD_STRING_LENGTH_LIMIT - 50;


/******************************************************************************
 *                                API Endpoints                               *
 ******************************************************************************/
// Logging any requests then sending them to their proper endpoint
app.use('/', (req: Request, _: Response, next: NextFunction) => {
  console.log('\n> Request URL:', req.originalUrl, '| Method:', req.method);
  next();
});

// Health check of API (making sure it's reachable)
app.get('/api/health', (_: Request, res: Response) => {
  res.json({
    health: 'OK',
  });
});

// Inserting a new blog post to datastore
app.post('/api/blog', (req: Request, res: Response) => {
  // Error if request missing expected data
  const blogData = (req.body) || {};
  if (!blogData.authorID) {
    console.error('Request missing authorID');
    return res.status(400).send({
      error: 'Missing authorID'
    });
  }
  if (!blogData.title) {
    console.error('Request missing title');
    return res.status(400).send({
      error: 'Missing title'
    });
  }
  if (!blogData.content) {
    console.error('Request missing content');
    return res.status(400).send({
      error: 'Missing content'
    });
  }

  // Cleaning up data before inserting into DB
  const authorID = blogData.authorID.trim().substring(0, DB_STR_LIMIT);
  const title = blogData.title.trim().substring(0, DB_STR_LIMIT);
  const content = blogData.content.trim().substring(0, DB_STR_LIMIT);
  const date = new Date().getTime(); // <-- Get blog post creation time

  // Inserting blog post into datastore
  firestore.collection(COLLECTION_NAME).add({
    authorID,
    date,
    title,
    content
  }).then((doc: any) => {
    console.info('stored new doc id#', doc.id);
    return res.status(200).send(doc);
  }).catch((err: any) => {
    console.error(err);
    return res.status(404).send({
      error: 'unable to store',
      err
    });
  });
});


/******************************************************************************
 *                         Listening Server Execution                         *
 ******************************************************************************/
const port = (process.env.PORT && parseInt(process.env.PORT)) || 8080;
app.listen(port, () => {
  console.log(`Attaching to port ${port}`);
});
