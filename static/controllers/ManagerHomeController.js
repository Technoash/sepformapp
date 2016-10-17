myApp.controller('ManagerHomeController', function($scope, $request, $misc, $alert, $rootScope) {
	$scope.$misc = $misc;

	$scope.selectedFormID = null;
	$scope.selectedForm = null;
	$scope.selectedFormSubmissions = [];

	$scope.accounts = [];
	$scope.forms = [];

	$scope.loadFormList = function(){
		$request.get('/manager/homepage').then(function(res){
			console.log(res);
			$scope.forms = res.data.forms;
			$scope.accounts = res.data.accounts;
			$scope.$apply();
		});
	}
	$scope.openForm = function(id){
		$request.get('/manager/form/get/'+id).then(function(res){
			console.log(res);
			$scope.selectedFormID = id;
			$scope.selectedForm = res.data.form;
			$scope.selectedFormSubmissions = res.data.submissions;
			$scope.$apply();
		});
	}
	$scope.closeForm = function(){
		$scope.selectedFormID = null;
		$scope.selectedForm = null;
		$scope.selectedFormSubmissions = [];
		$scope.selectedFormAccounts = [];
	}

	$scope.isAccountManager = function(id){
		return typeof _.find($scope.selectedForm.managers, function(o){
			return o == id;
		}) !== 'undefined';
	}

	$scope.toggleManager = function(id){
		console.log(_);
		if($scope.isAccountManager(id)){
			//remove
			if($scope.selectedForm.managers.length == 1) return $alert.info('You can not remove the last manager of this form');

			$request.post('/manager/form/manager/remove', {formID: $scope.selectedFormID, accountID: id})
			.then(function(res){
				_.remove($scope.selectedForm.managers, function(managerID) {
					return managerID == id;
				});

				if(id == $rootScope.auth.account._id){
					_.remove($scope.forms, function(form) {
						return form._id == $scope.selectedFormID;
					});
					$scope.closeForm();
					$alert.success("You removed yourself as a manager");
				}
				else $alert.success("Manager removed from form");
				$scope.$apply();
			});
		}
		else{
			//add
			$request.post('/manager/form/manager/add', {formID: $scope.selectedFormID, accountID: id})
			.then(function(res){
				$scope.selectedForm.managers.push(id);
				$scope.$apply();
				$alert.success("Manager added to form");
			});
		}
	}

	$scope.loadFormList();
});