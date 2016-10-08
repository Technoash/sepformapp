var _ = require('lodash');
var inspector = require('schema-inspector');
var Promise = require("bluebird");
var password = require('password-hash-and-salt-promise');

// POST RESPONSE HTTP STATUSES
//  200 - good
//  400 - user error
//  500 - unexpected server error, or unxepexted JSON format
//  401 - need to log in

module.exports = function (webServer, mongoose) {
	var Form = mongoose.model('Form');
	var Field = mongoose.model('Field');
	var Account = mongoose.model('Account');
	var Session = mongoose.model('Session');

	function validateAccess(access){
		return function(req, res, next){
			if(typeof req.session.sessionID === 'undefined'){
				res.status(401).send('No cookie');
				return;
			}

			function AuthError(clientMessage) {
				this.clientMessage = clientMessage;
			}
			AuthError.prototype = Object.create(Error.prototype);

			var session;
			//find session with id from cookie
			Session.findOne().where('_id').equals(req.session.sessionID)
			.then(result => {
				//if session dosen't exist in db
				if(result == null) throw new AuthError('No session');
				session = result;
				if(Date.now() > session.endTime){
					//you have to do .then() to insert it into a promise chain for it to execute
					Session.remove({ _id: session._id }).then();
					throw new AuthError('Session expired');
				}
				//get account from session
				return Account.findOne().where('_id').equals(session.account);
			})
			.then(result => {
				if(result == null) throw new AuthError('Account dosen\'t exist');
				var account = result;
				if(account.access == access || account.access == 'manager'){
					req.session.account = account;
					return next();
				}
				throw new AuthError('Not privelleged enough');
			})
			.catch(AuthError, e => {
				res.status(401).send(e.clientMessage);
			})
			.catch(e => {
				res.status(500).send('Internal error');
				throw e;
			})
		}
	}


	webServer.get('/test', validateAccess('user'), function(req, res) {
		console.log('GAGAGAGAGAGAGAGAGAGAAAAAAGGGGGAAAAAA');
		res.status(200).send('ayyy');
	});
	webServer.get('/test2', function(req, res) {
		res.status(200).send();
	});
	webServer.get('/test3', function(req, res) {
		res.status(400).send();
	});

	webServer.get('/createInitialAccount', function(req, res) {
		password('kmonney69').hash()
		.then(hash => {
			return Account.create({email: "ashneil.roy@gmail.com", name: "Ashneil Roy", password: hash, cid: "98126016", access: "user"});
		})
		.then(() => {
			res.send('account created');
		})
		.catch(e => {
			res.status(500).send('error');
			throw e;
		})
	});

	webServer.get('/auth/check', validateAccess('user'), function(req, res) {
		res.send({account: _.pick(req.session.account, ['email', 'name', 'cid', 'access'])});
	});

	webServer.post('/auth/login', function(req, res) {
		//validate post JSON
		var validation = inspector.validate({
			type: 'object',
			properties: {
				email: {type: "string"},
				password: {type: "string"},
				remember: {type: "boolean"}
			}
		}, req.body);

		if(!validation.valid) return res.status(500).send("request validation failed.");
		
		function LoginError(clientMessage) {
			this.clientMessage = clientMessage;
		}
		LoginError.prototype = Object.create(Error.prototype);

		//get account
		var account;
		Account.find().where('email').equals(req.body.email.toLowerCase())
		.then(result => {
			if(result.length != 1) throw new LoginError('Account not found');
			account = result[0];
			//check password
			return password(req.body.password).verifyAgainst(account.password);
		})
		.then(passAccepted => {
			if(!passAccepted) throw new LoginError('Password incorrect');
			//delete any existing sessions for this account
			return Session.remove({ account: account._id });
		})
		.then(() => {
			//create a new session
			//var endTime = Date.now() + 2*60*60*1000
			var endTime = Date.now() + 500*1000;
			//   if remember me, add 6 hours
			//if(req.body.remember) endTime += 6*60*60*1000
			return Session.create({account: account._id, endTime: endTime, remember: req.body.remember})
		})
		.then(newSession => {
			//set cookie and send account information
			req.session.sessionID = newSession._id;
			res.send({account: _.pick(account, ['email', 'name', 'cid', 'access']), session: {expiresIn: newSession.endTime - Date.now()}});
		})
		.catch(LoginError, e => {
			res.status(400).send(e.clientMessage);
		})
		.catch(e => {
			res.status(500).send("Internal error");
			throw e;
		})
	});

	webServer.get('/homepage', validateAccess('user'), function(req, res) {
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
		if(!inspector.validate(validation, req.body)) return response.status(500).send("request validation failed.");

		//validate field types
		for(var i=0; i < req.body.fields.length; i++){
			if(req.body.fields[i].type != "text") return response.status(500).send("request validation failed.");
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