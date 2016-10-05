module.exports = function (mongoose) {
	Schema = mongoose.Schema;
	
    var FieldSchema = new Schema({
		type: {type: String, enum: ['number', 'text']},
		name: String,
		helper: String,
		required: Boolean
	});
	var FormSchema = new Schema({
		name: String,
		created: {type: Date, default: Date.now},
		enabled: {type: Boolean, default: true},
		fields: [Schema.Types.ObjectId]
	});

	mongoose.model('Form', FormSchema); 
	mongoose.model('Field', FieldSchema); 
};