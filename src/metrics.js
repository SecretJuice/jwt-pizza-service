const config = require('./config');
const crypto = require('crypto');
const metricsConfig = config.metrics;
const os = require('os');

let intervalId;

let metrics = {
  requests: {
    total: 0,
    get: 0,
    put: 0,
    post: 0,
    delete: 0,
    latency: 0
  },
  activeUsers: 0,
  authenticationAttempts: {
    successful: 0,
    failed: 0
  },
  cpu: 0,
  memory: 0,
  pizzas: {
    sold: 0,
    created: 0,
    revenue: 0,
    latency: 0
  },
}

function randomMetricOffset(floor = 1, ceiling = 200) {
  return Math.floor(Math.random() * (ceiling-floor)) + floor + 1;
}


function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}


// Called every set interval to inquire on metrics that are ok to gather once 
// every two seconds
function updateMetricsCache() {
  metrics.cpu = getCpuUsagePercentage()
  metrics.memory = getMemoryUsagePercentage()

  // replace with DB query against sessions
  metrics.activeUsers = randomMetricOffset(300, 350);

  metrics.pizzas.latency += randomMetricOffset();
  metrics.pizzas.sold += randomMetricOffset();
  metrics.pizzas.created += randomMetricOffset();
  metrics.pizzas.revenue += randomMetricOffset();

  metrics.authenticationAttempts.successful += randomMetricOffset();
  metrics.authenticationAttempts.failed += randomMetricOffset();
}

function pipeMetrics() {
  sendMetricToGrafana('cpu', metrics.cpu, 'gauge', '%');
  sendMetricToGrafana('memory', metrics.memory, 'gauge', '%');

  sendMetricToGrafana('requests_total', metrics.requests.total, 'sum', '1');
  sendMetricToGrafana('requests_get', metrics.requests.get, 'sum', '1');
  sendMetricToGrafana('requests_put', metrics.requests.put, 'sum', '1');
  sendMetricToGrafana('requests_post', metrics.requests.post, 'sum', '1');
  sendMetricToGrafana('requests_delete', metrics.requests.delete, 'sum', '1');

  sendMetricToGrafana('service_latency', metrics.requests.latency, 'sum', 'ms');
  sendMetricToGrafana('pizza_latency', metrics.pizzas.latency, 'sum', 'ms');

  // TODO: figure out what to actually put in 'sum'
  sendMetricToGrafana('active_users', metrics.activeUsers, 'sum', 'ms');


  sendMetricToGrafana('pizzas_sold', metrics.pizzas.sold, 'sum', 'ms');
  sendMetricToGrafana('pizzas_created', metrics.pizzas.created, 'sum', 'ms');
  sendMetricToGrafana('revenue', metrics.pizzas.revenue, 'sum', 'ms');

  sendMetricToGrafana('auth_success', metrics.authenticationAttempts.successful, 'sum', 'ms');
  sendMetricToGrafana('auth_failure', metrics.authenticationAttempts.failed, 'sum', 'ms');
}

function startMetrics() {
  if (intervalId) {
    return intervalId;
  }

  intervalId = setInterval(() => {
    updateMetricsCache();
    pipeMetrics();
  }, 2000);

  return intervalId;
}

function stopMetrics() {
  if (!intervalId) {
    return;
  }

  clearInterval(intervalId);
  intervalId = undefined;
}

function sendMetricToGrafana(metricName, metricValue, type, unit) {
  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      asInt: metricValue,
                      timeUnixNano: Date.now() * 1000000,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === 'sum') {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
  }

  const body = JSON.stringify(metric);
  fetch(metricsConfig.endpointUrl, {
    method: 'POST',
    body: body,
    headers: { Authorization: `Bearer ${metricsConfig.accountId}:${metricsConfig.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
        });
      } 
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

async function requestLogMiddleware(req, res, next) {
  req.requestId = crypto.randomUUID()
  let start = Date.now()
  // export to graphana
  console.log(`Request Received: time=${start}, path=${req.path}, method=${req.method}, reqId=${req.requestId}`)

  res.on('finish', ()=>{
    let end = Date.now()
    let duration = end - start
    // export to graphana
    console.log(`Response Issued : time=${end}, status=${res.statusCode}, duration=${duration}ms, reqId=${req.requestId}`)

    metrics.requests.total += 1
    metrics.requests.latency += duration

    switch(req.method) {
      case 'GET':
        metrics.requests.get += 1
        break;
      case 'PUT':
        metrics.requests.put += 1
        break;
      case 'POST':
        metrics.requests.post += 1
        break;
      case 'DELETE':
        metrics.requests.delete += 1
        break;
    }
  
  })

  await next()


}

module.exports = { startMetrics, stopMetrics, requestLogMiddleware };
