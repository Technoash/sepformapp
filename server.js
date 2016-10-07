console.log("Formie Server v2");
console.log("WARNING: Concurrency and request validation not fully implemented");

var port = 8000;
var dbip = '172.17.0.3';

var Promise = require("bluebird");
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var morgan = require('morgan');
var mongoose = require('mongoose');

//replace builtin promises with bluebird
mongoose.Promise = require('bluebird');

//connect to mongodb
mongoose.connect("mongodb://" + dbip + "/dev");

//load mongdb schemas
require('./schemas.js')(mongoose);

var webServer = express();


//set up HTTP logging
webServer.use(morgan("-----------\\n:method  :url\\n-----------\\nRES-TIME: :response-time ms\\nREMOTE-ADDRESS: :remote-addr\\n-----------\\n\\n"));
//set up POST request JSON parsing, cookie parsing
webServer.use(bodyParser.urlencoded({ extended: false }));
webServer.use(bodyParser.json());
webServer.use(cookieParser());
webServer.use(expressSession({secret:'kj3bwrtpiuohwe9p8hfipq324un4p9hef0h2oiuhgv6'}));

//register HTTP routes
require('./routes.js')(webServer, mongoose);
//serve files in 'static' directory too
webServer.use(express.static('static'));

//start listening for HTTP requests
webServer.listen(port, function () {
	console.log('HTTP server listening on port ' + port + '!');
});