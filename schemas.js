module.exports = function (mongoose) {
	Schema = mongoose.Schema;

	mongoose.model('Field', new Schema({
		type: {type: String, enum: ['number', 'text']},
		name: String,
		helper: String,
		required: Boolean
	}));

	mongoose.model('Form', new Schema({
		name: {type: String, required: true},
		created: {type: Date, default: Date.now},
		enabled: {type: Boolean, default: true},
		fields: [Schema.Types.ObjectId]
	})); 
	 
	mongoose.model('Account', new Schema({
		email: {type: String, required: true, unique: true},
		created: {type: Date, default: Date.now},
		name: String,
		password: String,
		cid: String,
		creator: Schema.Types.ObjectId,
		access: {type: String, required: true, enum: ['user', 'manager']}
	}));

	mongoose.model('Session', new Schema({
		account: {type: Schema.Types.ObjectId, required: true},
		startTime: {type: Date, default: Date.now},
		endTime: {type: Date, required: true},
		remember: Boolean
	}));

	mongoose.model('Submission', new Schema({
		account: {type: Schema.Types.ObjectId, required: true},
		form: {type: Schema.Types.ObjectId, required: true},
		values: [new Schema({
			value: {type: String, required: true},
			fieldID: {type: Schema.Types.ObjectId, required: true}
		})],
		created: {type: Date, default: Date.now},
		status: {type: String, required: true, enum: ['submitted', 'saved', 'accepted', 'declined', 'returned']}
	}));

	mongoose.model('Comment', new Schema({
		submission: {type: Schema.Types.ObjectId, required: true},
		created: {type: Date, default: Date.now},
		author: {type: Schema.Types.ObjectId, required: true},
		content: {type: String, required: true},
		public: {type: Boolean, required: true}
	}));

	mongoose.model('Notification', new Schema({
		submission: {type: Schema.Types.ObjectId, required: true},
		created: {type: Date, default: Date.now},
		for: {type: Schema.Types.ObjectId, required: true},
		content: {type: String, required: true}
	}));
};