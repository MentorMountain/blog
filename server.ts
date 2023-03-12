/******************************************************************************
 *                               Imports + Setup                              *
 ******************************************************************************/
// Firestore (DB) import
import { Firestore, QuerySnapshot, QueryDocumentSnapshot } from '@google-cloud/firestore';

// Firestore (DB) setup
const PROJECT_ID: string = process.env.PROJECT_ID || "double-willow-379721"; // TODO-JAROD: REMOVE THE PROJECT CREDENTIALS!!
const COLLECTION_NAME: string = process.env.DB_COLLECTION_NAME || "blog"; // TODO-JAROD: REMOVE THE PROJECT CREDENTIALS!!
const firestore: Firestore = new Firestore({
  projectId: PROJECT_ID,
  timestampsInSnapshots: true
  // NOTE: Don't hardcode your project credentials here.
  // If you have to, export the following to your shell:
  //   GOOGLE_APPLICATION_CREDENTIALS=<path>
  // keyFilename: '/cred/cloud-functions-firestore-000000000000.json',
});

// Express (REST) import
import express, { Express } from 'express';
import { Request, Response, NextFunction } from 'express';
// Express (REST) setup
const app: Express = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS (security?) import
import cors from "cors";
// CORS (security?) setup
app.use(cors({
  origin: '*'
}));

// Data models
import { BlogPostResponseData } from './src/model/BlogPostResponseData';
import { BlogPostSubmissionData } from './src/model/BlogPostSubmissionData';


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
 *                              Helper Functions                              *
 ******************************************************************************/
// Reduce the length of the (string) field in a request such that it meets...
// ...the gcloud length limit - whitespace is trimmed too
const cleanRequestField = (requestField: string): string => {
  return requestField.trim().substring(0, DB_STR_LIMIT);
};


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
  const blogData: BlogPostSubmissionData = (req.body) || {};
  // TODO-#2: Validate/authenticate authorID 
  if (!blogData.authorID) {
    console.error('Request missing authorID');
    return res.status(400).send();
  }
  if (!blogData.title) {
    console.error('Request missing title');
    return res.status(400).send();
  }
  if (!blogData.content) {
    console.error('Request missing content');
    return res.status(400).send();
  }

  // Cleaning up data before inserting into DB
  const authorID: string = cleanRequestField(blogData.authorID);
  const title: string = cleanRequestField(blogData.title);
  const content: string = cleanRequestField(blogData.content);
  const date: number = new Date().getTime(); // <-- Get blog post creation time

  // Inserting blog post into datastore
  firestore.collection(COLLECTION_NAME)
  .add({
    authorID,
    date,
    title,
    content
  }).then((doc: any) => {
    console.info('stored new doc id#', doc.id);
    return res.status(201).send();
  }).catch((err: any) => {
    console.error(err);
    return res.status(400).send();
  });
});

// Return a list of all existing blogs
app.get('/api/blog', (_: Request, res: Response) => {
  // Get all blog documents from firestore and create a response using...
  // ...their IDs and data
  const blogPosts: BlogPostResponseData[] = [];
  firestore.collection(COLLECTION_NAME)
    .get()
    .then((data: QuerySnapshot) => {
      data.forEach((doc: QueryDocumentSnapshot) => {
        blogPosts.push({
          postID: doc.id,
          authorID: doc.data().authorID,
          date: doc.data().date,
          title: doc.data().title,
          content: doc.data().content
        });
      });
      const responseData: string = JSON.stringify(blogPosts);
      console.log('send data in response:', responseData);
      return res.status(200).send(responseData);
    }).catch((err: any) => {
      console.error(err);
      return res.status(400).send();
    });
});


/******************************************************************************
 *                         Listening Server Execution                         *
 ******************************************************************************/
const port = (process.env.PORT && parseInt(process.env.PORT)) || 8080;
app.listen(port, () => {
  console.log(`Attaching to port ${port}`);
});
