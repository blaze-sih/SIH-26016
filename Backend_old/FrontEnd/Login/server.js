const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Parse form submissions (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// GET /login -> show the sign-in page
app.get("/login", (req, res) => {
  res.render("lrvs-login", {
    error: null,
    userId: "MH-REV-4471", // pre-filled demo value, matches the design
  });
});

// POST /login -> handle the form submit
app.post("/login", (req, res) => {
  const { userId, password } = req.body;

  // Demo rule from the original design: typing "wrong" previews the error state.
  // Replace this block with real authentication (DB check, hashed password, etc).
  if (!password || password.trim().toLowerCase() === "wrong") {
    return res.render("lrvs-login", {
      error: "Invalid User ID or password. Please try again.",
      userId, // keep whatever the user typed
    });
  }

  // TODO: replace with real session/auth logic
  res.send(`
    <div style="font-family:sans-serif;padding:40px;text-align:center;">
      <h2>Signed in successfully</h2>
      <p>Officer ID: <strong>${userId}</strong></p>
      <p><a href="/login">Back to login</a></p>
    </div>
  `);
});

// Redirect root straight to the login page
app.get("/", (req, res) => res.redirect("/login"));

app.listen(PORT, () => {
  console.log(`LRVS login demo running at http://localhost:${PORT}/login`);
});
