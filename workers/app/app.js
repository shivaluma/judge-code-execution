const fs = require('fs');
const amqp = require('amqp-connection-manager');
const redis = require('redis');
const bail = require('bail');
const rimraf = require('rimraf');

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

function runCode(apiBody, ch, msg) {
  client.set(apiBody.folder.toString(), '{"status":"Processing"}');
  const { exec } = require('child_process');
  var output;
  var command =
    'python3 run.py ../temp/' +
    apiBody.folder +
    '/source.' +
    extensions[apiBody.lang] +
    ' ' +
    apiBody.lang +
    ' ' +
    apiBody.timeOut;

  fs.writeFile('/temp/' + apiBody.folder + '/output.txt', '', function (err) {
    if (err) console.log(err);
  });

  fs.writeFile(
    '/temp/' + apiBody.folder + '/expected_result.txt',
    apiBody.expected_result,
    function (err) {
      if (err) console.log(err);
    }
  );

  exec(command, (err, stdout, stderr) => {
    if (err) {
      ch.ack(msg);
      console.log(err);
    } else {
      if (err) console.log(err);
      console.log(stdout);
      let result;
      try {
        var time = stdout.trim().split('!@#');
        var status = time.pop().trim() || '';

        let output = time.pop().trim() || '';
        if (status === 'Wrong Answer') {
          output = output.split('|||');
        }
        result = {
          input: output[0],
          output: output[1],
          expected_answer: output[2],
          time_used: time.map((el) => el.trim()),
          stderr: `${stderr}`,
          status: `${status}`,
          submission_id: apiBody.folder,
          isError: false,
        };
      } catch (err) {
        result = {
          output: '',
          expected_answer: '',
          time_used: [],
          stderr: stderr,
          status: status || 'Memory Exceeded',
          submission_id: apiBody.folder,
          isError: true,
        };
      }

      rimraf('../temp/' + apiBody.folder, function (err) {
        if (err) console.log(err);
      });

      client.setex(apiBody.folder.toString(), 3600, JSON.stringify(result));
      ch.ack(msg);
    }
  });
}

function createFiles(apiBody, ch, msg) {
  fs.mkdir('/temp/' + apiBody.folder, function (err) {
    if (err) {
      console.log(err);
    } else {
      fs.writeFile(
        '/temp/' + apiBody.folder + '/input.txt',
        apiBody.input,
        function (err) {
          if (err) return console.log(err);
          else {
            fs.writeFile(
              '/temp/' + apiBody.folder + '/source.' + extensions[apiBody.lang],
              apiBody.src,
              function (err) {
                if (err) console.log(err);
                else {
                  runCode(apiBody, ch, msg);
                }
              }
            );
          }
        }
      );
    }
  });
}

const QUEUE_NAME = 'judge';
var onMessage = function (data) {
  let message = JSON.parse(data.content.toString());
  createFiles(message, channelWrapper, data);
};

// Create a connetion manager
var connection = amqp.connect(['amqp://rabbitmq:5672']);

connection.on('connect', function () {
  console.log('Connected!');
});
connection.on('disconnect', function (err) {
  console.log('Disconnected.', err.stack);
});

// Set up a channel listening for messages in the queue.
var channelWrapper = connection.createChannel({
  setup: function (channel) {
    // `channel` here is a regular amqplib `ConfirmChannel`.
    return Promise.all([
      channel.assertQueue(QUEUE_NAME, { durable: true }),
      channel.prefetch(1),
      channel.consume(QUEUE_NAME, onMessage),
    ]);
  },
});

channelWrapper.waitForConnect().then(function () {
  console.log('Listening for messages');
});
