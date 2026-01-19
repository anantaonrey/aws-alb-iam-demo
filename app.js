const express = require('express');
const AWS = require('aws-sdk');
const os = require('os');

/* ================= AWS HARD CODED (DEMO ONLY) ================= */
AWS.config.update({
  accessKeyId: 'XXXXXXXXXXXXXXXXX', 
  secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  region: 'ap-south-1'
});

/* ================= AWS CLIENT ================= */
const ec2 = new AWS.EC2({ region: 'ap-south-1' });
const s3 = new AWS.S3({ region: 'ap-south-1' });
const rds = new AWS.RDS({ region: 'ap-south-1' });

/* ================= APP ================= */
const app = express();
const PORT = 3000;

/* ================= LOCAL UTILS ================= */
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'N/A';
}

function getLocalUsage() {
  const cpus1 = os.cpus();
  const t1 = cpus1.reduce((a, c) => a + c.times.idle, 0);
  const s1 = cpus1.reduce(
    (a, c) => a + Object.values(c.times).reduce((x, y) => x + y, 0),
    0
  );

  return new Promise(resolve => {
    setTimeout(() => {
      const cpus2 = os.cpus();
      const t2 = cpus2.reduce((a, c) => a + c.times.idle, 0);
      const s2 = cpus2.reduce(
        (a, c) => a + Object.values(c.times).reduce((x, y) => x + y, 0),
        0
      );

      const cpu = (((s2 - s1) - (t2 - t1)) / (s2 - s1) * 100).toFixed(2);

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const ram = (((totalMem - freeMem) / totalMem) * 100).toFixed(2);

      resolve({ cpu, ram });
    }, 200);
  });
}

/* ================= API ================= */
app.get('/api/stats', async (req, res) => {
  try {
    const localUsage = await getLocalUsage();

    // AWS counts (region ap-south-3)
    const ec2Res = await ec2.describeInstances().promise();
    let ec2Count = 0;
    ec2Res.Reservations.forEach(r => ec2Count += r.Instances.length);

    const s3Res = await s3.listBuckets().promise();
    const rdsRes = await rds.describeDBInstances().promise();

    res.json({
      servedByIp: getLocalIP(),          // 🔥 INI KUNCI DEMO ALB
      hostname: os.hostname(),           // 🔥 BEDA TIAP EC2
      localCpu: localUsage.cpu,
      localRam: localUsage.ram,
      region: 'ap-south-3',
      ec2Count,
      s3Count: s3Res.Buckets.length,
      rdsCount: rdsRes.DBInstances.length
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= FRONTEND ================= */
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>ALB Demo Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      background: linear-gradient(135deg, #020024, #090979, #00d4ff);
      font-family: 'Segoe UI', sans-serif;
      color: #fff;
      padding: 30px;
    }
    h1 { text-shadow: 0 0 15px #00eaff }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }
    .card {
      background: rgba(0,0,0,0.45);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 0 25px rgba(0,234,255,0.3);
      backdrop-filter: blur(8px);
    }
    canvas { max-height: 220px }
    .big {
      font-size: 1.3em;
      color: #00f7ff;
    }
  </style>
</head>
<body>

<h1>🚦 Application Load Balancer Demo</h1>

<div class="grid">
  <div class="card">
    <h2>Request Served By</h2>
    <div class="big" id="servedIp">-</div>
    <div id="hostname">-</div>
  </div>

  <div class="card">
    <h2>AWS Region</h2>
    <div class="big" id="region">-</div>
    <div>EC2: <span id="ec2"></span></div>
    <div>S3: <span id="s3"></span></div>
    <div>RDS: <span id="rds"></span></div>
  </div>
</div>

<br>

<div class="grid">
  <div class="card">
    <h3>Local CPU Usage</h3>
    <canvas id="cpuChart"></canvas>
  </div>

  <div class="card">
    <h3>Local RAM Usage</h3>
    <canvas id="ramChart"></canvas>
  </div>
</div>

<script>
fetch('/api/stats')
  .then(r => r.json())
  .then(d => {
    document.getElementById('servedIp').innerText = d.servedByIp;
    document.getElementById('hostname').innerText = d.hostname;
    document.getElementById('region').innerText = d.region;
    document.getElementById('ec2').innerText = d.ec2Count;
    document.getElementById('s3').innerText = d.s3Count;
    document.getElementById('rds').innerText = d.rdsCount;

    new Chart(document.getElementById('cpuChart'), {
      type: 'doughnut',
      data: {
        labels: ['Used', 'Free'],
        datasets: [{ data: [d.localCpu, 100 - d.localCpu] }]
      }
    });

    new Chart(document.getElementById('ramChart'), {
      type: 'doughnut',
      data: {
        labels: ['Used', 'Free'],
        datasets: [{ data: [d.localRam, 100 - d.localRam] }]
      }
    });
  });
</script>

</body>
</html>
`);
});

/* ================= START ================= */
app.listen(PORT, '0.0.0.0', () => {
  console.log('ALB demo app running on port', PORT);
});
