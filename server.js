const express = require('express');
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const { request } = require('https');
const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname,"notesdata.db")


const initializeDbAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        })
        app.listen(3000,() => {
            console.log('Server running successfully at http://localhost:3000/')
        })

    } catch(e){
     console.log(`DB Error: ${e.message}`)
     process.exit(1);
    }
}

initializeDbAndServer();

//Authenticate
const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      });
    }
  };

//Register User 
app.post("/signup",async(request,response) => {
    const {name, password,email} = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM users WHERE name = '${name}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        users (name, password,email) 
      VALUES 
        (
          '${name}',
          '${hashedPassword}', 
          '${email}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
})

//Login API 
app.post("/login", async (request, response) => {
    const { name, password } = request.body;
    const selectUserQuery = `SELECT * FROM Users WHERE name = '${name}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid User");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {
          name: name,
        };
        const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
        response.send({ jwtToken });
      } else {
        response.status(400);
        response.send("Invalid Password");
      }
    }
  });

  //API 1 
  app.get('/notes/',authenticateToken,async (request,response) => {
    const getNotesQuery = `
    SELECT notes.id,title,content,category,notes.created_at as createdAt
    ,updated_at as updatedAt,pinned,archived
    FROM notes 
    INNER JOIN users ON notes.user_id = users.id
    ;
    `;
    const notesQuery = await db.all(getNotesQuery)
    response.send(notesQuery)
  })

  //API 2 
  app.post("/notes/",authenticateToken,async(request,response) => {
   const {id,title,content,category,createdAt,updatedAt,pinned,archived,userId} = request.body
   const createNotesQuery = `
   INSERT INTO notes(id,title,content,category,created_at,updated_at,pinned,archived,user_id)
   VALUES(${id},'${title}','${content}','${category}','${createdAt}','${updatedAt}','${pinned}','${archived}',${userId})
   ;`;
   const dbResponse = await db.run(createNotesQuery)
   const  newUserId = dbResponse.lastID
   response.send("Notes Created Successfully")
})

//API 3 
app.put("/notes/:id",authenticateToken,async(request,response) => {
  const {title,content,category} = request.body
  const {id} = request.params 
  const updateNotesQuery = `
  Update notes 
  SET 
  title = '${title}',
  content = '${content}',
  category = '${category}'
  Where id = ${id}
  ;`;
  await db.run(updateNotesQuery);
  response.send("Notes Updated")
})

//API 4 
app.delete("/notes/:id",authenticateToken, async (request,response) => {
  const {id} = request.params 
  const deleteNotesQuery = `
  DELETE 
  FROM notes
  WHERE 
  id = ${id}; 
  `;
  await db.run(deleteNotesQuery)
  response.send("Notes Deleted")
})

//API 5 
app.patch("/notes/:id/pin",authenticateToken, async(request,response) => {
const {pinned} = request.body
const {id} = request.params 
const patchQuery = `
Update notes 
SET 
pinned = ${pinned};`;
await db.run(patchQuery)
response.send("Pin Updated")
})

//API 6 
app.patch("/notes/:id/archive",authenticateToken, async(request,response) =>{
  const {archived} = request.body 
  const {id} = request.params 
  const patchQuery = `
  Update notes 
  SET 
  archived = ${archived};`;
  await db.run(patchQuery)
  response.send("Archive Updated")
})
