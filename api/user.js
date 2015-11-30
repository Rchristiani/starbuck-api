'use strict';

let user = {};
let models = require('./models/index.js');
let bcrypt = require('bcryptjs');
let config = require('../config.js');
let jwt = require('jsonwebtoken');
let mandrill = require('mandrill-api');

let simplePassword = (length) => {
	let chars = 'abcdefghijklmnopqrstuvwxyz01234567890!@#$%^&*()';
	let password = '';

	for(let i = 0; i < length; i++) {
		password += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return password;
};

let sendEmail = (templateName,options) => {
	let emailOptions = {
		message : {
			"subject": "Welcome to HackerYou!",
			"from_email": "info@hackeryou.com",
			"from_name": "HackerYou",
			"to": [{
				"email": options.email,
				"name": options.firstName + ' ' + options.lastName,
				"type": "to"
			}]
		},
		messageContent : [
			{
				"name": "email",
				"content": options.email
			},
			{
				"name" : "password",
				"content" : options.password
			},
			{
				"name" : "url",
				"content" : options.url
			}
		],
		templateName: templateName
	};
	return new Promise((resolve, reject) => {
		mandrill.messages.sendTemplate({
			"template_name" : email.templateName,
			"template_content" : email.messageContent,
			"message": email.message,
			"async": false,
			"ip_pool": 'Main Pool'
		}, 
		function(result) {
			if(result[0].status === 'sent') {
				resolve('Email Sent');
			}
			else {
				reject('Error', result[0].reject_reason);
			}
		}, function(err) {
			console.log(err);
		});	
	});
};

user.createUser = (req,res) => {
	let emails = req.body.emails;
	emails = emails.split(',');

	let users = emails.map((email) => {
		let password = simplePassword(10);
		let model = {
			email: email,
			password: (() => {
				return bcrypt.hashSync(password,10);
			})(),
			created_at: +new Date()
		};
		return new models.user(model).save();
	});
	Promise.all(users).then((data) => {
		res.send({
			message: 'success',
			usersAdded: data.length 
		});
	},(err) => {
		res.send({
			error: err
		});
	});
};

user.getUsers = (req,res) => {
	models.user.find({},{password:0,__v:0},(err,docs) => {
		if(err) {
			res.send({
				error: err
			});
		}
		else {
			res.send({
				user: docs
			});
		}
	});
};

user.getUser = (req,res) => {
	let id = req.params.id;
	models.user.findOne({_id:id},{__v:0,password:0},(err,doc) => {
		if(err) {
			res.send({
				error: err
			});
		}
		else {
			res.send({
				user: doc
			});
		}
	}).populate('courses');
};

user.updateUser = (req,res) => {
	let id = req.params.id;
	let model = req.body;
	model.updated_at = +new Date();
	models.user.findOne({_id:id},(err,doc) => {
		doc.update({$set: model.toObject()}, (err) =>{
			if(err) {
				res.send({
					error: err
				});
			}
			else {
				models.user.findOne({_id:id}, {__v:0,password: 0},(err,newdoc) => {
					if(err) {
						res.send({
							error: err
						});
					}
					else {
						res.send({
							user: newdoc
						});
					}
				});
			}
		});
	});
};

user.removeUser = (req,res) => {
	let id = req.params.id;

	models.user.findOne({_id:id}, (err,doc) => {
		if(err) {
			res.send({
				error: err
			});
		}
		else {
			doc.remove((err) => {
				if(err) {
					res.send({
						error: err
					});
				}
				else {
					res.send({
						user: []
					});
				}
			});
		}
	});
};	

user.authenticate = (req,res) => {
	let email = req.query.email;
	let password = req.query.password;

	models.user.findOne({email:email},(err,doc) => {
		if(err || !doc) {
			res.send({
				success: false,
				message: 'User does not exist'
			});
		}
		else {
			bcrypt.compare(password,doc.password, (err,result) => {
				if(err || !result) {
					res.send({
						success: false,
						message: 'Authentication failed',
						token: ''
					});
				}
				else {
					let token = jwt.sign({
						name: `${doc.firstName} ${doc.lastName}`,
						admin: (() => {
							return doc.admin !== undefined ? doc.admin : false
						})()
					}, 
					config.secret, 
					{
						expiresIn: "2 days"
					});
					res.send({
						success: true,
						message: 'Authentication successful',
						token: token,
						user_id: doc._id
					});
				}
			});
		}
	});
};



module.exports = user;





