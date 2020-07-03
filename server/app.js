const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cp = require('child_process');
const fs = require('fs');
const rimraf = require('rimraf');
const cors = require('cors');
const redis = require('redis');
const amqp = require('amqp-connection-manager');

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

const client = redis.createClient({
  host: 'redis-server',
  port: 6379,
});

client.on('error', (err) => {
  console.log('Error ' + err);
});

const extensions = {
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  python3: 'py',
};

function random(size) {
  return require('crypto').randomBytes(size).toString('hex');
}
app.post('/submit', (req, res) => {
  let data = {
    src: req.body.src,
    input: req.body.stdin,
    expected_result: req.body.expected_result,
    lang: req.body.lang,
    timeOut: req.body.timeout,
    folder: random(10),
  };

  sendMessage(data);
  res.status(202).send('http://' + req.hostname + '/results/' + data.folder);
});

app.get('/results/:id', (req, res) => {
  let key = req.params.id;
  client.get(key, (err, status) => {
    if (status == null) {
      res.status(202).json({ status: 'Queued' });
    }

    const response = JSON.parse(status);
    if (response.status == 'Processing') {
      res.status(202).json(response);
    }
    return res.status(200).json(response);
  });
});

var QUEUE_NAME = 'judge';

// Create a connetion manager
var connection = amqp.connect(['amqp://rabbitmq:5672']);
connection.on('connect', function () {
  console.log('Connected!');
});
connection.on('disconnect', function (err) {
  console.log('Disconnected.', err.stack);
});

// Create a channel wrapper
var channelWrapper = connection.createChannel({
  json: true,
  setup: function (channel) {
    return channel.assertQueue(QUEUE_NAME, { durable: true });
  },
});

// Send messages until someone hits CTRL-C or something goes wrong...
var sendMessage = function (data) {
  channelWrapper
    .sendToQueue(QUEUE_NAME, data)
    .then(function () {
      console.log('Message sent');
    })
    .catch(function (err) {
      console.log('Message was rejected:', err.stack);
      // channelWrapper.close();
      // connection.close();
    });
};

const port = process.env.PORT || 7000;
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
