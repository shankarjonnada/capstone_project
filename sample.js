var express = require('express');
var app = express();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
var bodyParser = require('body-parser');
var request = require('request');
const ejs = require('ejs');
const bcrypt = require('bcrypt'); 

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

var serviceAccount = require("./key.json");
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

app.use(express.static(__dirname));
app.set('view engine', 'ejs');

// Function to hash passwords
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Function to check for duplicate email
async function isEmailUnique(email) {
  const querySnapshot = await db.collection("studentsinfo")
    .where("Email", "==", email)
    .get();
  return querySnapshot.empty;
}

app.get('/', function (req, res) {
  res.sendFile(__dirname + "/home.html");
});

app.get('/signup', function (req, res) {
  res.sendFile(__dirname + "/signuppage2.html");
});

app.post('/signupsubmit', async function (req, res) {
  const { fullname, email, password } = req.body;

  // Check if email is unique
  const isUnique = await isEmailUnique(email);

  if (!isUnique) {
    return res.send("Email address is already in use. Please choose another email.");
  }

  // Hash the password before storing
  const hashedPassword = await hashPassword(password);

  // Store the user data
  db.collection("studentsinfo").add({
    Fullname: fullname,
    Email: email,
    password: hashedPassword
  });

  res.redirect("/login");
});

app.get('/login', function (req, res) {
  res.sendFile(__dirname + "/loginpage2.html");
});

app.post('/loginsubmit', async function (req, res) {
  const { email, password } = req.body;

  const querySnapshot = await db.collection("studentsinfo")
    .where("Email", "==", email)
    .get();

  if (querySnapshot.empty) {
    return res.send("Email not found. Please check your email or sign up.");
  }

  const userDoc = querySnapshot.docs[0];
  const hashedPassword = userDoc.data().password;

  // Compare hashed password
  const passwordMatch = await bcrypt.compare(password, hashedPassword);

  if (passwordMatch) {
    res.redirect("/covid");
  } else {
    res.send("Incorrect password. Please try again.");
  }
});

app.get('/covid', function (req, res) {
  res.render("covid");
});

app.post('/gettCases', (req, res) => {
  const country = req.body.country;
  const date = req.body.date;
  const apiKey = 'xFlweWswhHuQH42fntKnzt8T941O1vzfZn2U4iYp';

  const apiUrl = 'https://api.api-ninjas.com/v1/covid19';
  const requestUrl = `${apiUrl}?country=${country}`;

  request.get({
      url: requestUrl,
      headers: {
          'X-Api-Key': apiKey
      }
  }, (error, response, body) => {
      if (error) {
          console.error('Request error:', error);
          return res.status(500).json({ error: 'Request failed' });
      }

      if (response.statusCode !== 200) {
          console.error('API error:', response.statusCode, body);
          return res.status(response.statusCode).json({ error: 'Error fetching data' });
      }

      try {
          const casesData = JSON.parse(body);
          const countryRegionData = casesData.find(data => data.country.toLowerCase() === country.toLowerCase());

          if (!countryRegionData) {
              return res.status(404).json({ error: `No data available for ${country} on ${date}` });
          }

          const casesForDate = countryRegionData.cases[date];

          if (typeof casesForDate === 'undefined') {
              return res.status(404).json({ message: `No data available for ${date}. It's possible that no cases were registered for this date in ${country}.` });
          }

          const casesResult = `On ${date}, ${country} had ${casesForDate.total} total confirmed cases and ${casesForDate.new} new confirmed cases of COVID-19.`;

          res.json({ result: casesResult });
      } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.log('API Response:', body); 
          return res.status(500).json({ error: 'Error parsing API response' });
      }
  });
});

app.get('/home', function (req, res) {
  res.sendFile(__dirname + "/home.html");
});

app.get('/logout', function (req, res) {
  res.redirect("/home");
});

app.listen(3000, function () {
  console.log('Running on port 3000!');
});
