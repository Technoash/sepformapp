myApp.controller('HomeController', function($scope, $request, $misc) {
	$scope.forms = {};
	$scope.submissions = {};
	$scope.notifications = {};
	$scope.$misc = $misc;

	$scope.loadFormList = function(){
		$request.get('/homepage').then(function(res){
			$scope.forms = res.data.forms;
			$scope.submissions = res.data.submissions;
			$scope.notifications = res.data.notifications;
			$scope.$apply();
		});
	}

	$scope.loadFormList();
});