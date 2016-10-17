myApp.controller('SubmissionController', function($scope, $request, $routeParams, $location, $route, $alert, $misc, $rootScope) {
	//new, incomplete, view
	$scope.$rootScope = $rootScope;
	$scope.$misc = $misc;
	$scope.state = $route.current.$$route.data.state;
	$scope.form = {};
	$scope.fields = [];
	$scope.submission = {values: []};
	$scope.notifications = [];
	$scope.accounts = [];
	$scope.comment = {content: ""};
	$scope.valueErrors = {};

	$scope.loadForm = function(){
		if($scope.state == 'new') {
			$request.get('/form/template/get/'+$routeParams.formID)
			.then(function(res){
				$scope.form = res.data.form;
				$scope.fields = res.data.fields;
				for(var i = 0; i < $scope.fields.length; i++) $scope.submission.values.push({value: "", fieldID: $scope.fields[i]._id});
				$scope.$apply();
			});
		}
		if($scope.state == 'incomplete' || $scope.state == 'view') {
			$request.get('/form/submission/get/'+$routeParams.submissionID)
			.then(function(res){
				/// submission, form, fields, notifications, accounts
				$scope.form = res.data.form;
				$scope.fields = res.data.fields;
				$scope.submission = res.data.submission;
				$scope.notifications = res.data.notifications;
				$scope.accounts = res.data.accounts;
				$scope.$apply();
				$scope.commentScrollBottom();
			});
		}
	}

	$scope.whoAmI = function(){
		if(typeof _.find($scope.form.managers, function(o){
			return o == $rootScope.auth.account._id;
		}) !== 'undefined')
			return 'manager';
		return 'user';
	}

	$scope.isEditable = function(){
		return $scope.state == 'new' || $rootScope.auth.account._id == $scope.submission.account && ($scope.submission.state == 'saved' || $scope.submission.state == 'returned')
	}

	$scope.valueByID = function(id){
		for(var i = 0; i < $scope.submission.values.length; i++){
			if($scope.submission.values[i].fieldID == id){
				return $scope.submission.values[i];
			}
		}
	}

	$scope.submitForm = function(saved){
		$scope.valueErrors = {};
		for(var i = 0; i < $scope.fields.length; i++){
			var field = $scope.fields[i];
			if(field.type == "text" && field.required && $scope.valueByID(field._id).value == "") $scope.valueErrors[field._id] = field.name + " is required and cannot be empty";
			if(field.type == "date" && field.required && $scope.valueByID(field._id).value == "") $scope.valueErrors[field._id] = field.name + " is required and cannot be empty";
		}

		for(var i = 0; i < $scope.fields.length; i++){
			if(!saved && $scope.fields[i].type == "date" && $scope.valueByID($scope.fields[i]._id).value === null) $scope.valueByID($scope.fields[i]._id).value = "";
		}

		if(!saved && _.size($scope.valueErrors) > 0) return $alert.warning('Some fields in your submission are not valid');

		var tosend = {form: $scope.form._id, values: $scope.submission.values, saved: saved};

		if($scope.state == 'incomplete' || $scope.state == 'view') tosend['submissionID'] = $routeParams.submissionID;
		$request.post('/form/submission/new', tosend)
		.then(function(res){
			if(saved) $location.path("/user");
			if(!saved){
				$location.path("/submission/view/" + res.data);
				if($scope.submission._id == res.data) $route.reload();
			}
			$alert.success('Submission ' + ((saved) ? 'saved':'created'));
			$scope.$apply();
		})
	}

	$scope.commentScrollBottom = function(){
		var elem = document.getElementById('commentBoxScrollContainer');
  		elem.scrollTop = elem.scrollHeight;
	}

	$scope.updateState = function(newState){
		var reqData = {submissionID: $routeParams.submissionID, state: newState};
		if(newState == 'comment' || newState == 'comment_manager'){
			reqData['content'] = $scope.comment.content;
			console.log('comment', $scope.comment.content);
		}
		$request.post('/form/submission/state/update', reqData)
		.then(function(res){
			if(newState != 'comment' && newState != 'comment_manager'){
				$scope.submission.state = newState;
				$alert.success("State of form changed");
			}
			else{
				//comment
				$alert.success("Comment added");
				$scope.comment.content = "";
			}
			$scope.notifications.push(res.data);
			$scope.$apply();
			$scope.commentScrollBottom();
		});
	}
	//handle err
	$scope.loadForm();
});