(function() {
    'use strict';

    angular.module('lavagna.components').component('lvgCardActivity', {
        bindings: {
            card: '&',
            project: '&'
        },
        templateUrl: 'app/components/card/activity/card-activity.html',
        controller: ['EventBus', '$element', '$q', 'Card', 'StompClient', CardActivityController]
    });

    function CardActivityController(EventBus, $element, $q, Card, StompClient) {
        var ctrl = this;

        var card = ctrl.card();
        var NUMBER_OF_COMMENTS;
        var NUMBER_OF_ACTIVITIES;

        ctrl.activityFilterValue = 'COMMENT';
        ctrl.renderedItems = 10;

        var ITEMS_INCREMENT = 10;

        function activityFilter (activity, index, activities) {
            if(ctrl.activityFilterValue === null) {
                return true;
            }

            return activity.cardEvent === ctrl.activityFilterValue && ctrl.comments[activity.dataId] !== undefined;
        }

        ctrl.resetVisibleCount = function () {
            ctrl.renderedItems = 10;
        }

        ctrl.loadMore = function () {
            if(ctrl.renderedItems >= (ctrl.activityFilter == 'COMMENT' ? NUMBER_OF_COMMENTS : NUMBER_OF_ACTIVITIES)) {
                return;
            }

            ctrl.renderedItems += ITEMS_INCREMENT;
        };

        //
        ctrl.addComment = addComment;

        ctrl.activityFilter = activityFilter;
        //

        var stompSubscription = angular.noop;
        var unbindCardCache = angular.noop;

        ctrl.$onInit = function init() {
        	ctrl.comments = {};
            ctrl.activities = [];

            loadData({comments: loadComments(), activities: loadActivity()});


            //the /card-data has various card data related event that are pushed from the server that we must react
            stompSubscription = StompClient.subscribe('/event/card/' + card.id + '/card-data', function(e) {
                var type = JSON.parse(e.body).type;

                var promisesObject = {activities: loadActivity()};
                if(type.match(/COMMENT/g) !== null) {
                    promisesObject.comments = loadComments();
                }
                loadData(promisesObject);
            });

            // reload activities when the card is moved/renamed
            unbindCardCache = EventBus.on('refreshCardCache-' + card.id, function() {
                loadData({activities: loadActivity()});
            });
        }

        ctrl.$onDestroy = function onDestroy() {
        	stompSubscription();
        	unbindCardCache();
        }

        ctrl.$postLink = function postLink() {

        }

        function loadComments() {
            return Card.comments(card.id);
        }

        function loadActivity() {
            return Card.activity(card.id);
        }

        function loadData(promisesObject) {
            $q.all(promisesObject).then(function(result) {
                if(result.comments) {
                    NUMBER_OF_COMMENTS = result.comments.length;
                    ctrl.hasComments = NUMBER_OF_COMMENTS > 0;
                    ctrl.comments = {};
                    angular.forEach(result.comments, function(comment) {
                        ctrl.comments[comment.id] = comment;
                    });
                }
                if(result.activities) {
                    NUMBER_OF_ACTIVITIES = result.activities.length;
                    ctrl.activities = [];
                    angular.forEach(result.activities, function(activity) {
                        activity.cardEvent = activity.event === 'COMMENT_CREATE' && ctrl.comments[activity.dataId] !== undefined ?
                            'COMMENT' :
                            activity.event;
                        ctrl.activities.push(activity);
                    });
                }
            })
        }

        function addComment(comment) {
            Card.addComment(card.id, comment).then(function() {
                comment.content = null;

                // update the number of rendered comments when going above threshold
                if(ctrl.renderedItems <= NUMBER_OF_COMMENTS) {
                    ctrl.loadMore();
                }
            });
        }
    };
})();
