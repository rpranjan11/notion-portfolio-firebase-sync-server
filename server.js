// server.js
const { exec } = require('child_process');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const basicAuth = require('express-basic-auth');

// Add before your routes
app.use(basicAuth({
    users: { 'admin': 'ranjan' },
    challenge: true
}));

// Add this to package.json: "express": "^4.18.2"

app.get('/', (req, res) => {
    res.send('Firebase-Notion sync service is running');
});

// Add an endpoint to manually trigger sync
app.get('/sync', (req, res) => {
    exec('node sync.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).send(`Error: ${error.message}`);
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }
        console.log(`stdout: ${stdout}`);
        res.send('Sync process completed!');
    });
});

app.get('/dashboard', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Firebase-Notion Sync Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        button { background: #4CAF50; color: white; border: none; padding: 15px 32px; 
                text-align: center; font-size: 16px; cursor: pointer; border-radius: 4px; }
        .status { margin-top: 20px; padding: 15px; border-radius: 4px; }
        .success { background-color: #dff0d8; color: #3c763d; }
        .error { background-color: #f2dede; color: #a94442; }
      </style>
    </head>
    <body>
      <h1>Firebase-Notion Sync Dashboard</h1>
      <p>Use the button below to manually trigger a sync from Firebase to Notion.</p>
      <button onclick="triggerSync()">Sync Now</button>
      <div id="status" class="status"></div>
      
      <script>
        function triggerSync() {
          document.getElementById('status').textContent = 'Syncing...';
          document.getElementById('status').className = 'status';
          
          fetch('/sync')
            .then(response => response.text())
            .then(data => {
              document.getElementById('status').textContent = data;
              document.getElementById('status').className = 'status success';
            })
            .catch(error => {
              document.getElementById('status').textContent = 'Error: ' + error;
              document.getElementById('status').className = 'status error';
            });
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});