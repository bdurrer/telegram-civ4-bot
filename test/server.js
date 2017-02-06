/**
  Serves content we need to test the content fetch
*/

const PORT = 8080;
const DIRECTORY = __dirname;


const http = require('http');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const serve = serveStatic(__dirname);

server = http.createServer((req, res) => {
  var done = finalhandler(req, res);
  serve(req, res, done);
}).listen(PORT);

console.log(`Server serving ${DIRECTORY} on port ${PORT}`);
