import {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from "@google-cloud/firestore";
import {
  LoginTokenizedRequest,
  LoginTokenParameters,
  validateLoginToken,
} from "cmpt474-mm-jwt-middleware";
import cors from "cors";
import express, { Express, NextFunction, Request, Response } from "express";
import ENV from "./env";
import { BlogPostResponseData } from "./src/model/BlogPostResponseData";
import { BlogPostSubmissionData } from "./src/model/BlogPostSubmissionData";

// Firestore (DB) setup
const COLLECTION_NAME: string = ENV.DB_COLLECTION_NAME!;
const firestore: Firestore = new Firestore({
  projectId: ENV.PROJECT_ID,
  timestampsInSnapshots: true,
  // NOTE: Don't hardcode your project credentials here.
  // If you have to, export the following to your shell:
  //   GOOGLE_APPLICATION_CREDENTIALS=<path>
  // keyFilename: '/cred/cloud-functions-firestore-000000000000.json',
});

const app: Express = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", cors({ origin: "*" }), (_: Request, res: Response) => {
  res.json({
    health: "OK",
  });
});

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if ([ENV.WEBAPP_DOMAIN, "http://localhost:3000"].indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));

const LOGIN_TOKEN_VALIDATION_PARAMETERS: LoginTokenParameters = {
  JWT_SECRET: ENV.JWT_SECRET,
  GATEWAY_DOMAIN: ENV.GATEWAY_DOMAIN,
  WEBAPP_DOMAIN: ENV.WEBAPP_DOMAIN,
};
const LOGIN_TOKEN_VALIDATOR = validateLoginToken(
  LOGIN_TOKEN_VALIDATION_PARAMETERS
);

/******************************************************************************
 *                             Datastore Constants                            *
 ******************************************************************************/
// Firestore states field value length limit for indexed fields as 1,500 bytes
// - UTF-8 chars take up 2 bytes each: therefore 750 character length limit
// If you want to increase this limit, verify that we are using NON-INDEXED...
// ...field values
// See: https://firebase.google.com/docs/firestore/quotas#limits
const GCLOUD_STRING_LENGTH_LIMIT: number = 750;
// DB_STR_LIMIT slightly shorter for safety
const DB_STR_LIMIT: number = GCLOUD_STRING_LENGTH_LIMIT - 50;

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
app.use("/", (req: Request, _: Response, next: NextFunction) => {
  console.log("\n> Request URL:", req.originalUrl, "| Method:", req.method);
  next();
});

app.use(LOGIN_TOKEN_VALIDATOR);

// Inserting a new blog post to datastore
app.post("/api/blog", (req: Request, res: Response) => {
  const blogRequest: LoginTokenizedRequest = req as LoginTokenizedRequest;

  if (blogRequest.user.role !== "mentor") {
    return res.status(403).send("Only Mentors can post blogs.");
  } 
  // Error if request missing expected data
  const blogData: BlogPostSubmissionData = blogRequest.body || {};
  // TODO-#2: Validate/authenticate authorID
  const postAuthorID = blogRequest.user.username;

  if (!blogData.title) {
    console.error("Request missing title");
    return res.status(400).send();
  }
  if (!blogData.content) {
    console.error("Request missing content");
    return res.status(400).send();
  }

  // Cleaning up data before inserting into DB
  const authorID: string = postAuthorID;
  const title: string = cleanRequestField(blogData.title);
  const content: string = cleanRequestField(blogData.content);
  const date: number = new Date().getTime(); // <-- Get blog post creation time

  // Inserting blog post into datastore
  firestore
    .collection(COLLECTION_NAME)
    .add({
      authorID,
      date,
      title,
      content,
    })
    .then((doc: any) => {
      console.info("stored new doc id#", doc.id);
      return res.status(201).send();
    })
    .catch((err: any) => {
      console.error(err);
      return res.status(400).send();
    });
});

// Return a list of all existing blogs
app.get("/api/blog", (_: Request, res: Response) => {
  // Get all blog documents from firestore and create a response using...
  // ...their IDs and data
  const blogPosts: BlogPostResponseData[] = [];
  firestore
    .collection(COLLECTION_NAME)
    .get()
    .then((data: QuerySnapshot) => {
      data.forEach((doc: QueryDocumentSnapshot) => {
        const blogPostData: DocumentData = doc.data();
        blogPosts.push({
          postID: doc.id,
          authorID: blogPostData.authorID,
          date: blogPostData.date,
          title: blogPostData.title,
          content: blogPostData.content,
        });
      });
      const responseData: string = JSON.stringify(blogPosts);
      console.log("send data in response:", responseData);
      return res.status(200).send(responseData);
    })
    .catch((err: any) => {
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
