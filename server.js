console.log("Formie Server v2");
console.log("WARNING: Concurrency and request validation not fully implemented");

var port = 8000;
var dbip = '172.17.0.2';

var Promise = require("bluebird");
var express = require('express');
var bodyParser = require('body-parser');
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
//set up POST request JSON parsing
webServer.use(bodyParser.urlencoded({ extended: false }));
webServer.use(bodyParser.json());

//register HTTP routes
require('./routes.js')(webServer, mongoose);
//server files in 'static' directory too
webServer.use(express.static('static'));

//start listening for HTTP requests
webServer.listen(port, function () {
	console.log('HTTP server listening on port ' + port + '!');
});