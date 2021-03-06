(function($, Backbone, _, app){
    // 通用视图模版，用来为所有视图建模
    var TemplateView = Backbone.View.extend({
        templateName: '',
        initialize: function(){
            this.template = _.template($(this.templateName).html());
        },
        render: function(){
            var context = this.getContext(),
                html = this.template(context);
            this.$el.html(html);
        },
        getContext: function(){
            return {};
        }
    });
    // var LoginView = TemplateView.extend({
    //     id: 'login',
    //     templateName: '#login-template',
    //     events: {
    //         'submit form': 'submit'
    //     },
    //     submit: function(event){
    //         var data = {};
    //         event.preventDefault();
    //         this.form = $(event.currentTarget);
    //         data = {
    //             username: $(':input[name="username"]', this.form).val(),
    //             password: $(':input[name="password"]', this.form).val(),
    //         };
    //         $.post(app.apiLogin, data)
    //             .done($.proxy(this.loginSuccess, this))
    //             .fail($.proxy(this.loginFailure, this));
    //     },
    //     loginSuccess: function(data){
    //         app.session.save(data.token);
    //         this.trigger('login', data.token)
    //     },
    //     loginFailure: function (xhr, status, error) {
    //         var errors = xhr.responseJSON;
    //         this.showErrors(errors);
    //     },
    //     showErrors: function (errors) {
    //         //TODO: show the errors from response
    //         _.map(errors, function (fieldErrors, name) {
    //             var field = $(':input[name='+name+']', this.form),
    //                 label = $('label[for='+field.attr('id')+']', this.form);
    //             if(label.length === 0){
    //                 label = $('label', this.form).first();
    //             }
    //             function appendError(msg) {
    //                 label.before(this.errorTemplate({msg: msg}));
    //             }
    //             _.map(fieldErrors, appendError, this);
    //         }, this);
    //     },
    //     clearErrors: function () {
    //         $('.error', this.form).remove();
    //     }
    // });


    // 通用表单视图
    var FormView = TemplateView.extend({
        events:{
            'submit form': 'submit',
            'click button.cancel': 'done'
        },
        errorTemplate: _.template('<span class="error"><%- msg %></span>'),
        clearErrors: function () {
            $('.error', this.form).remove();
        },
        showErrors:function (errors) {
            _.map(errors, function (fieldErrors, name) {
                var field = $(':input[name' + name+ ']', this.form),
                    label = $('label[for=' + field.attr('id')+']', this.form);
                if(label.length === 0){
                    label = $('label', this.form).first();
                }
                function appendError(msg) {
                    label.before(this.errorTemplate({msg: msg}));
                }
                _.map(fieldErrors, appendError, this);
            },this);
        },
        // 表单序列化方法
        serializeForm: function(form){
            return _.object(_.map(form.serializeArray(), function(item){
                // Convert object to tuple of(name, value)
                return [item.name, item.value];
            }));
        },
        submit: function (event) {
            event.preventDefault();
            this.form = $(event.currentTarget);
            this.clearErrors();
        },
        failure: function(xhr, status, error){
            var errors = xhr.responseJSON;
            this.showErrors(errors);
        },
        done: function(event){
            if(event){
                event.preventDefault();
            }
            this.trigger('done');
            this.remove();
        },
        modelFailure: function(model, xhr, options){
            var errors = xhr.responseJSON;
            this.showErrors(errors);
        }
    });
    //头
    var HeaderView = TemplateView.extend({
        tagName: 'header',
        templateName: '#header-template',
        events: {
            'click a.logout': 'logout'
        },
        getContext: function(){
            return {
                authenticated: app.session.authenticated()
            };
        },
        logout: function(event){
            event.preventDefault();
            app.session.delete();
            window.location= '/';
        },
    });
    //登陆
    var LoginView = FormView.extend({
        id: 'login',
        templateName: '#login-template',
        // submit回调阻止了表单的提交，因此视图可以来提交并处理结果
        submit: function(event){
            var data = {};
            // 是一个有效的调用父类方法的等价方式
            FormView.prototype.submit.apply(this, arguments);
            data = this.serializeForm(this.form);
            $.post(app.apiLogin, data)   //apiLogin在app中定义了
                .done($.proxy(this.loginSuccess, this))
                .fail($.proxy(this.failure, this));
        },
        loginSuccess: function(data){
            app.session.save(data.token);
            this.done();
        }
    });
    // 新建sprint
    var NewSprintView = FormView.extend({
        templateName: '#new-sprint-template',
        className: 'new-sprint',
        // 默认的submit事件由基类FormView处理，这里定义了取消按钮事件调用done方法
        // events: _.extend({
        //     'click button.cancel': 'done'
        // }, FormView.prototype.events),
        submit: function(event){
            var self = this,
                attributes = {};
            FormView.prototype.submit.apply(this, arguments);
            attributes = this.serializeForm(this.form);
            app.collections.ready.done(function () {
                // 直接调用create方法，无需手动调用$.post
                app.sprints.create(attributes,{
                    wait: true,
                    success: $.proxy(self.success, self),
                    error: $.proxy(self.modelFailure, self)
                });
            });
        },
        success: function (model) {
            this.done();
            window.location.hash = '#sprint/' + model.get('id');
        }
    });
    // home页
    var HomepageView = TemplateView.extend({
        templateName: '#home-template',
        events: {
            // 添加按钮的click事件由renderAddForm来处理
            'click button.add': 'renderAddForm'
        },
        // 结束日期大于7天前的sprint会被获取
        initialize: function (options) {
            var self = this;
            TemplateView.prototype.initialize.apply(this, arguments);
            app.collections.ready.done(function () {
                var end = new Date();
                end.setDate(end.getDate()-7);
                end = end.toISOString().replace(/T.*/g, '');
                app.sprints.fetch({
                    data: {end_min: end},
                    success: $.proxy(self.render, self)
                });
            });
        },
        getContext: function () {
            // 模版上下文使用app.sprints中的sprint填充，如果未定义会填充null
            return {sprints: app.sprints || null};
        },
        renderAddForm: function (event) {
            var view = new NewSprintView(),
                link = $(event.currentTarget);
            event.preventDefault();
            link.before(view.el);
            link.hide();
            view.render();
            view.on('done',function(){
                link.show();
            });
        }
    });

    var AddTaskView = FormView.extend({
        templateName: '#new-task-template',
        // events: _.extend({
        //     'click button.cancel': 'done'
        // }, FormView.prototype.events),
        submit: function (event) {
            var self = this,
                attributes = {};
            FormView.prototype.submit.apply(this, arguments);
            attributes = this.serializeForm(this.form);
            app.collections.ready.done(function(){
                app.tasks.create(attributes, {
                    wait: true,
                    success: $.proxy(self.success, self),
                    error: $.proxy(self.modelFailure, self)
                });
            });
        },
        success: function (model, resp, options) {
            this.done();
        }
    });

    var StatusView = TemplateView.extend({
       tagName: 'section',
       className: 'status',
       templateName: '#status-template',
        events: {
           'click button.add': 'renderAddForm'
        },
       initialize: function (options) {
           TemplateView.prototype.initialize.apply(this, arguments);
           this.sprint = options.sprint;
           this.status = options.status;
           this.title = options.title;
       },
        getContext: function () {
            return {sprint: this.sprint, title: this.title}
        },
        renderAddForm: function (event) {
            var view = new AddTaskView(),
                link = $(event.currentTarget);
            event.preventDefault();
            link.before(view.el);
            link.hide();
            view.render();
            view.on('done', function () {
                link.show();
            });
        },
        addTask: function (view) {
            $('.list', this.$el).append(view.el);
        }
    });

    var TaskDetailView = FormView.extend({
        tagName: 'div',
        className: 'task-detail',
        templateName: '#task-detail-template',
        events: _.extend({
            // 查找所有contenteditable在模版中出现的地方，然后调用editField方法
            'blur [data-field][contenteditable=true]': 'editField'
        }, FormView.prototype.events),
        initialize: function (options) {
            FormView.prototype.initialize.apply(this, arguments);
            this.task = options.task;
            this.changes = {};
            $('button.save', this.$el).hide();
            this.task.on('change', this.render, this);
            this.task.on('remove', this.remove, this);
        },
        getContext:function () {
            return {task: this.task, empty:'-----'};
        },
        submit:function (event) {
            FormView.prototype.submit.apply(this, arguments);
            this.task.save(this.changes, {
                wait: true,
                success: $.proxy(this.success, this),
                error: $.proxy(this.modelFailure, this),
            });
        },
        success: function (model) {
            this.changes = {};
            $('button.save', this.$el).hide();
        },
        editField: function (event) {
            var $this = $(event.currentTarget),
                value = $this.text().replace(/^\s+|\s+$/g),
                field = $this.data('field');
            this.changes[field] = value;
            $('button.save', this.$el).show();
        }
    });

    var TaskItemView = TemplateView.extend({
        tagName: 'div',
        className: 'task-item',
        templateName: '#task-item-template',
        events: {
            'click': 'details'
        },
        initialize:function (options) {
            TemplateView.prototype.initialize.apply(this, arguments);
            this.task = options.task;
            this.task.on('change', this.render, this);
            this.task.on('remove', this.remove, this);
        },
        getContext:function(){
            return {task: this.task};
        },
        render: function () {
            TemplateView.prototype.render.apply(this, arguments);
            this.$el.css('order', this.task.get('order'));
        },
        // 创建一个新的TaskDetailView，当前视图将会被隐藏直到编辑完成
        details: function () {
            var view = new TaskDetailView({task: this.task});
            this.$el.before(view.el);
            this.$el.hide();
            view.render();
            view.on('done', function () {
                this.$el.show();
            }, this);
        }
    });

    var SprintView = TemplateView.extend({
        templateName: '#sprint-template',
        initialize: function (options) {
            var self = this;
            TemplateView.prototype.initialize.apply(this, arguments);

            this.sprintId = options.sprintId;
            this.sprint = null;

            this.tasks = {};
            this.statuses = {
                unassigned: new StatusView({
                    sprint: null, status: 1, title: 'Backlog'}),
                todo: new StatusView({
                    sprint: this.sprintId, status: 1, title: 'Not Started'}),
                active: new StatusView({
                    sprint: this.sprintId, status: 2, title: 'In Development'}),
                testing: new StatusView({
                    sprint:this.sprintId, status: 3, title: 'In Testing'}),
                done: new StatusView({
                    sprint: this.sprintId, status: 4, title: 'Completed'})
            };

            app.collections.ready.done(function () {
                app.tasks.on('add', self.addTask, self);
                app.sprints.getOrFetch(self.sprintId).done(function (sprint) {
                    self.sprint = sprint;
                    self.render();
                    // Add any current tasks
                    app.tasks.each(self.addTask, self);
                    //Fetch tasks for the current sprint
                    sprint.fetchTasks();
                }).fail(function (sprint) {
                    self.sprint = sprint;
                    self.sprint.invalid = true;
                    self.render();
                });
                // Fetch unassigned tasks
                app.tasks.getBacklog();
            });
        },
        getContext: function () {
            return {sprint: this.sprint};
        },
        render: function () {
            TemplateView.prototype.render.apply(this, arguments);
            _.each(this.statuses, function (view, name) {
                $('.tasks', this.$el).append(view.el);
                view.delegateEvents();
                view.render();
            }, this);

            _.each(this.tasks, function (view, taskId) {
                var task = app.tasks.get(taskId);
                view.remove();
                this.tasks[taskId] = this.renderTask(task);
            }, this);
        },
        addTask: function (task) {
            // TODO: Handle the task
            if(task.inBacklog()|| task.inSprint(this.sprint)){
                this.tasks[task.get('id')] = this.renderTask(task);
                // this.tasks[task.get('id')] = task;
                // this.renderTask(task);
            }
        },
        renderTask: function (task) {
            var view = new TaskItemView({task: task});
            _.each(this.statuses, function(container, name){
                if(container.sprint == task.get('sprint') &&
                container.status == task.get('status')){
                    container.addTask(view);
                }
            });
            view.render();
            return view;
        }
    });


    // // 登陆表单视图
    // var LoginView = Backbone.View.extend({
    //     id: 'login',
    //     templateName: '#login-template',
    //     initialize:function(){
    //         this.template = _.template($(this.templateName).html());
    //     },
    //     render: function () {
    //         var context = this.getContext(),
    //             html = this.template(context);
    //         this.$el.html(html);
    //     },
    //     getContext: function () {
    //         return {};
    //     }
    // });
    // // 主页表单视图
    // var HomepageView = Backbone.View.extend(
    //     {
    //         templateName: '#home-template',
    //         initialize: function () {
    //             this.template = _.template($(this.templateName).html());
    //         },
    //         render: function () {
    //             var context = this.getContext(),
    //                 html = this.template(context);
    //             this.$el.html(html);
    //         },
    //         getContext: function () {
    //             return {};
    //         }
    //     });
    app.views.HeaderView = HeaderView;
    app.views.LoginView = LoginView;
    app.views.HomepageView = HomepageView;
    app.views.SprintView = SprintView;
})(jQuery, Backbone, _, app);
