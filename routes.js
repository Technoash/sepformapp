var _ = require('lodash');
var inspector = require('schema-inspector');
var Promise = require("bluebird");

module.exports = function (webServer, mongoose) {
	var Form = mongoose.model('Form');
	var Field = mongoose.model('Field');
	var Account = mongoose.model('Account');

	function validateAuthCookie(req, res, next){
		
	}

	webServer.get('/test', function(req, res) {
		var password = require('password-hash-and-salt-promise');
		password('kmonney69').hash()
		.then(hash => {
			return Account.create({email: "ashneil.roy@gmail.com", name: "Ashneil Roy", password: hash, cid: "98126016"});
		})
		.then(() => {
			res.status(200).send('account created');
		})
		.catch(() => {
			res.status(500).send('error');
		})
	});

	webServer.get('/homepage', function(req, res) {
		var build = {forms: {}, submissions: {}};
		var exec = [];
		exec.push(
			Form.find({}, "_id name").where('enabled').equals(true)
			.then(a => {
				build.forms = a;
			})
		)
		Promise.all(exec)
		.then(() => {
			res.send(build);
		});
	});

	webServer.get('/form/manage', function(req, res) {
		Form.find({}, "_id enabled created name")
		.then(a => {
			res.send(a);
		})
	});


	webServer.post('/form/new', function(req, response) {
		var validation = {
			type: 'object',
			properties: {
				name: {type: "string"},
				fields: {
					type: "array",
					items: {
						type: "object",
						properties: {
							type: {type: "string"},
							name: {type: "string"},
							helper: {type: "string"},
							required: {type: "boolean"}
						}
					}
				}
			}
		};
		if(!inspector.validate(validation, req.body)) return response.status(400).send("request validation failed.");

		//validate field types
		for(var i=0; i < req.body.fields.length; i++){
			if(req.body.fields[i].type != "text") return response.status(400).send("request validation failed.");
		}

		//maybe check if form name in use already?

		//insert form and fields into database
		Field.create(req.body.fields)
		.then(a => {
			return Form.create({name: req.body.name, fields: _.map(a, '_id')});
		})
		.then(() => {
			response.send("ok");
			console.log("Form inserted");
		})
		.catch(e => {
			console.log('mongo error', e);
		})
	});
};