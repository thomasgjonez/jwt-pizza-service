const os = require('os');
const config = require('./config.js');

class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.requestsByMethod = {};
    this.requestsByEndpoint = {};

    this.pizzasSold = 0;
    this.purchaseFailures = 0;
    this.revenue = 0;
    this.purchaseLatencySum = 0;
    this.purchaseLatencyCount = 0;

    this.authAttemptsSuccess = 0;
    this.authAttemptsFailure = 0;
    this.activeUsers = 0;

    this.requestLatencySum = 0;
    this.requestLatencyCount = 0;

    // Bind so it can be handed directly to app.use(metrics.requestTracker)
    this.requestTracker = this.requestTracker.bind(this);

    this.sendMetricsPeriodically(10000);
  }

  // Express middleware that records a count and latency for every incoming request.
  requestTracker(req, res, next) {
    this.totalRequests++;

    const method = req.method;
    this.requestsByMethod[method] = (this.requestsByMethod[method] || 0) + 1;

    const endpoint = this.getEndpointGroup(req.baseUrl || req.originalUrl || req.url);
    this.requestsByEndpoint[endpoint] = (this.requestsByEndpoint[endpoint] || 0) + 1;

    const startTime = Date.now();
    res.on('finish', () => {
      this.requestLatencySum += Date.now() - startTime;
      this.requestLatencyCount++;
    });

    next();
  }

  // Called whenever a user successfully or unsuccessfully attempts to authenticate.
  authAttempt(success) {
    if (success) {
      this.authAttemptsSuccess++;
    } else {
      this.authAttemptsFailure++;
    }
  }

  // Called when a user logs in (delta = 1) or logs out (delta = -1).
  activeUserChange(delta) {
    this.activeUsers = Math.max(0, this.activeUsers + delta);
  }

  // Collapse a URL down to a low-cardinality group (e.g. /api/order) so metric
  // series don't explode with one series per order ID, menu item, etc.
  getEndpointGroup(url) {
    const path = url.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    return '/' + parts.slice(0, 2).join('/');
  }

  // Called whenever an order is placed with the Pizza Factory, success or not.
  pizzaPurchase(success, latencyMs, price, count = 0) {
    if (success) {
      this.pizzasSold += count;
      this.revenue += price;
    } else {
      this.purchaseFailures++;
    }

    this.purchaseLatencySum += latencyMs;
    this.purchaseLatencyCount++;
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  sendMetricsPeriodically(period) {
    const timer = setInterval(() => {
      try {
        this.sendMetricToGrafana('requests', this.totalRequests, 'sum', '1');

        Object.keys(this.requestsByMethod).forEach((method) => {
          this.sendMetricToGrafana('requests', this.requestsByMethod[method], 'sum', '1', { method });
        });

        Object.keys(this.requestsByEndpoint).forEach((endpoint) => {
          this.sendMetricToGrafana('requests', this.requestsByEndpoint[endpoint], 'sum', '1', { endpoint });
        });

        this.sendMetricToGrafana('cpu', this.getCpuUsagePercentage(), 'gauge', '%');
        this.sendMetricToGrafana('memory', Number(this.getMemoryUsagePercentage()), 'gauge', '%');

        this.sendMetricToGrafana('pizzas_sold', this.pizzasSold, 'sum', '1');
        this.sendMetricToGrafana('revenue', this.revenue, 'sum', 'BTC');
        this.sendMetricToGrafana('purchase_failures', this.purchaseFailures, 'sum', '1');

        if (this.purchaseLatencyCount > 0) {
          const averageLatency = this.purchaseLatencySum / this.purchaseLatencyCount;
          this.sendMetricToGrafana('purchase_latency', averageLatency, 'gauge', 'ms');
          this.purchaseLatencySum = 0;
          this.purchaseLatencyCount = 0;
        }

        this.sendMetricToGrafana('auth_attempts', this.authAttemptsSuccess, 'sum', '1', { result: 'success' });
        this.sendMetricToGrafana('auth_attempts', this.authAttemptsFailure, 'sum', '1', { result: 'failure' });
        this.sendMetricToGrafana('active_users', this.activeUsers, 'gauge', '1');

        if (this.requestLatencyCount > 0) {
          const averageRequestLatency = this.requestLatencySum / this.requestLatencyCount;
          this.sendMetricToGrafana('request_latency', averageRequestLatency, 'gauge', 'ms');
          this.requestLatencySum = 0;
          this.requestLatencyCount = 0;
        }
      } catch (error) {
        console.error('Error sending metrics', error);
      }
    }, period);

    // Don't let the periodic reporter keep the process alive (e.g. in tests).
    if (timer.unref) timer.unref();
  }

  sendMetricToGrafana(metricName, metricValue, type, unit, attributes = {}) {
    const dataPoint = {
      timeUnixNano: Date.now() * 1000000,
    };
    if (Number.isInteger(metricValue)) {
      dataPoint.asInt = metricValue;
    } else {
      dataPoint.asDouble = metricValue;
    }

    const attributeKeys = Object.keys(attributes);
    if (attributeKeys.length > 0) {
      dataPoint.attributes = attributeKeys.map((key) => ({
        key,
        value: { stringValue: String(attributes[key]) },
      }));
    }

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
                    dataPoints: [dataPoint],
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
    fetch(`${config.metrics.endpointUrl}`, {
      method: 'POST',
      body: body,
      headers: {
        Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
        'Content-Type': 'application/json',
      },
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
}

const metrics = new Metrics();
module.exports = metrics;
