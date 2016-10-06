module.exports = function (mongoose) {
	Schema = mongoose.Schema;

	mongoose.model('Field', new Schema({
		type: {type: String, enum: ['number', 'text']},
		name: String,
		helper: String,
		required: Boolean
	}));

	mongoose.model('Form', new Schema({
		name: String,
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
		creator: Schema.Types.ObjectId
	}));
};